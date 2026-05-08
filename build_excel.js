#!/usr/bin/env node
/**
 * 排班系統 Excel VBA 版本產生器
 * 執行後產生 schedule_system.xlsm，可直接用 Excel 開啟操作
 */
'use strict';

const XLSX = require('xlsx');
const CFB  = require('cfb');
const fs   = require('fs');

// ═══════════════════════════════════════════════════════════════════════════════
// MS-OVBA Compression (raw/uncompressed chunks, always valid)
// ═══════════════════════════════════════════════════════════════════════════════
function ovbaCompress(data) {
  if (!Buffer.isBuffer(data)) data = Buffer.from(data);
  const parts = [Buffer.from([0x01])]; // SignatureByte
  let offset = 0;
  while (offset < data.length) {
    const chunk  = data.slice(offset, offset + 4096);
    const padded = Buffer.alloc(4096);
    chunk.copy(padded);
    // Raw chunk: flag=0, sig=0b011=3, size=4096-3=4093=0xFFD
    // Word LE = 0x3FFD
    parts.push(Buffer.from([0xFD, 0x3F]));
    parts.push(padded);
    offset += 4096;
  }
  return Buffer.concat(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
// dir stream builder (MS-OVBA 2.3.4.2)
// ═══════════════════════════════════════════════════════════════════════════════
function rec(id, data) {
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const h = Buffer.alloc(6);
  h.writeUInt16LE(id, 0);
  h.writeUInt32LE(d.length, 2);
  return Buffer.concat([h, d]);
}
function u16(v) { const b=Buffer.alloc(2); b.writeUInt16LE(v,0); return b; }
function u32(v) { const b=Buffer.alloc(4); b.writeUInt32LE(v,0); return b; }

function buildDirStream(moduleName, moduleOffset) {
  const name    = Buffer.from(moduleName, 'ascii');
  const nameU16 = Buffer.from(moduleName.split('').map(c=>[c.charCodeAt(0),0]).flat());
  const parts   = [
    rec(0x0001, u32(0x00000001)),            // PROJECTSYSKIND = Win32
    rec(0x0002, u32(0x00000409)),            // PROJECTLCID = English
    rec(0x0014, u32(0x00000409)),            // PROJECTLCIDINVOKE
    rec(0x0003, u16(1252)),                  // PROJECTCODEPAGE = Windows-1252
    rec(0x0004, Buffer.from('VBAProject')),  // PROJECTNAME
    rec(0x0005, Buffer.alloc(0)),            // PROJECTDOCSTRING
    rec(0x0040, Buffer.alloc(0)),            // PROJECTDOCSTRINGUNICODE
    rec(0x0006, Buffer.alloc(0)),            // PROJECTHELPFILEPATH
    rec(0x003D, Buffer.alloc(0)),            // PROJECTHELPFILEPATH2
    rec(0x0007, u32(0)),                     // PROJECTHELPCONTEXT
    rec(0x0008, u32(0)),                     // PROJECTLIBFLAGS
    // PROJECTVERSION: fixed 4-byte size field then major(4)+minor(2)
    (() => {
      const h = Buffer.alloc(6); h.writeUInt16LE(0x0009,0); h.writeUInt32LE(4,2);
      const d = Buffer.alloc(6); d.writeUInt32LE(0x60,0); d.writeUInt16LE(0x0D,4);
      return Buffer.concat([h,d]);
    })(),
    rec(0x000C, Buffer.alloc(0)),            // PROJECTCONSTANTS
    rec(0x003C, Buffer.alloc(0)),            // PROJECTCONSTANTSUNICODE
    // PROJECTMODULES
    rec(0x000F, u32(1)),                     // count = 1
    rec(0x0013, u16(0xFFFF)),               // PROJECTCOOKIE
    // ── Module record ────────────────────────────────────────────────
    rec(0x0019, name),                       // MODULENAME
    rec(0x0031, nameU16),                    // MODULENAMEUNICODE  (same ID 0x0031 — first use)
    rec(0x001A, name),                       // MODULESTREAMNAME
    rec(0x0032, nameU16),                    // MODULESTREAMNAMEUNICODE
    rec(0x001C, Buffer.alloc(0)),            // MODULEDOCSTRING
    rec(0x0048, Buffer.alloc(0)),            // MODULEDOCSTRINGUNICODE
    rec(0x0031, u32(moduleOffset)),          // MODULEOFFSET  (same ID 0x0031 — second use = offset)
    rec(0x001E, u32(0)),                     // MODULEHELPCONTEXT
    rec(0x002C, u16(0xFFFF)),               // MODULECOOKIE
    rec(0x0021, Buffer.alloc(0)),            // MODULETYPE = procedural
    rec(0x002B, Buffer.alloc(0)),            // MODULETERMINATOR
    // ─────────────────────────────────────────────────────────────────
    rec(0x0010, Buffer.alloc(0)),            // PROJECTMODULETERMINATOR
  ];
  return Buffer.concat(parts);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VBA Source Code
// ═══════════════════════════════════════════════════════════════════════════════
const VBA_CODE = `
Attribute VB_Name = "Module1"
Option Explicit

Const DAYS      As Integer = 14
Const SH_STAFF  As String  = "Staff"
Const SH_CONFIG As String  = "Config"
Const SH_SCHED  As String  = "Schedule"
Const SH_COV    As String  = "StaffCov"
Const MAX_STAFF As Integer = 200

Type StaffRec
    sName      As String
    sGender    As String
    bBackup    As Boolean
    dayType(0 To 13) As Integer  ' 0=off 1=morning 2=evening 3=both
    mCnt       As Integer
    eCnt       As Integer
    tCnt       As Integer
End Type

' ---- Entry Point --------------------------------------------------------
Sub GenerateSchedule()
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim cfgWs As Worksheet
    On Error Resume Next
    Set cfgWs = Worksheets(SH_CONFIG)
    On Error GoTo ErrH

    If cfgWs Is Nothing Then
        MsgBox "Cannot find Config sheet. Please run Setup first.", vbExclamation
        GoTo Cleanup
    End If

    Dim startDt As Date
    startDt = cfgWs.Range("B2").Value
    If startDt = 0 Then
        MsgBox "Please enter a start date in Config!B2.", vbExclamation
        GoTo Cleanup
    End If

    Dim staff(0 To MAX_STAFF - 1) As StaffRec
    Dim nStaff As Integer
    Call ReadStaff(staff, nStaff)
    If nStaff = 0 Then
        MsgBox "No staff found in the Staff sheet.", vbExclamation
        GoTo Cleanup
    End If

    Dim mStaff(0 To DAYS - 1, 0 To MAX_STAFF - 1) As String
    Dim mCnt(0 To DAYS - 1)   As Integer
    Dim eStaff(0 To DAYS - 1, 0 To MAX_STAFF - 1) As String
    Dim eCnt(0 To DAYS - 1)   As Integer

    Call BuildSchedule(staff, nStaff, mStaff, mCnt, eStaff, eCnt)
    Call WriteSchedule(staff, nStaff, mStaff, mCnt, eStaff, eCnt, startDt)
    Call WriteStaffMatrix(staff, nStaff, mStaff, mCnt, eStaff, eCnt, startDt)

    Worksheets(SH_SCHED).Activate
    MsgBox "Schedule generated! See the Schedule and StaffCov sheets.", vbInformation
    GoTo Cleanup

ErrH:
    MsgBox "Error " & Err.Number & ": " & Err.Description, vbCritical
Cleanup:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
End Sub

' ---- Read staff from Staff sheet ----------------------------------------
Sub ReadStaff(staff() As StaffRec, nStaff As Integer)
    nStaff = 0
    Dim ws As Worksheet
    Set ws = Worksheets(SH_STAFF)
    Dim r As Integer: r = 3
    Do While ws.Cells(r, 1).Value <> ""
        Dim s As StaffRec
        s.sName   = CStr(ws.Cells(r, 1).Value)
        s.sGender = CStr(ws.Cells(r, 2).Value)
        Dim bkv As String: bkv = LCase(CStr(ws.Cells(r, 3).Value))
        s.bBackup = (bkv = "yes" Or bkv = "y" Or bkv = "true" Or bkv = "1")
        Dim d As Integer
        For d = 0 To 13
            Dim sv As String: sv = LCase(CStr(ws.Cells(r, 4 + d).Value))
            Select Case sv
                Case "m", "morning", "1": s.dayType(d) = 1
                Case "e", "evening", "2": s.dayType(d) = 2
                Case "b", "both",    "3": s.dayType(d) = 3
                Case Else:                s.dayType(d) = 0
            End Select
        Next d
        s.mCnt = 0: s.eCnt = 0: s.tCnt = 0
        staff(nStaff) = s
        nStaff = nStaff + 1
        r = r + 1
    Loop
End Sub

' ---- Build schedule (balanced round-robin) -------------------------------
Sub BuildSchedule(staff() As StaffRec, nStaff As Integer, _
                  mStaff() As String, mCnt() As Integer, _
                  eStaff() As String, eCnt()  As Integer)
    Dim elig(0 To MAX_STAFF - 1) As Integer
    Dim nElig As Integer
    Dim d As Integer, i As Integer, idx As Integer

    For d = 0 To DAYS - 1
        ' -- Morning --
        nElig = 0
        For i = 0 To nStaff - 1
            If staff(i).dayType(d) = 1 Or staff(i).dayType(d) = 3 Then
                elig(nElig) = i: nElig = nElig + 1
            End If
        Next i
        Call SortByCount(elig, nElig, staff)
        mCnt(d) = 0
        For i = 0 To nElig - 1
            idx = elig(i)
            mStaff(d, mCnt(d)) = staff(idx).sName
            mCnt(d) = mCnt(d) + 1
            staff(idx).mCnt = staff(idx).mCnt + 1
            staff(idx).tCnt = staff(idx).tCnt + 1
        Next i
        ' -- Evening --
        nElig = 0
        For i = 0 To nStaff - 1
            If staff(i).dayType(d) = 2 Or staff(i).dayType(d) = 3 Then
                elig(nElig) = i: nElig = nElig + 1
            End If
        Next i
        Call SortByCount(elig, nElig, staff)
        eCnt(d) = 0
        For i = 0 To nElig - 1
            idx = elig(i)
            eStaff(d, eCnt(d)) = staff(idx).sName
            eCnt(d) = eCnt(d) + 1
            staff(idx).eCnt = staff(idx).eCnt + 1
            staff(idx).tCnt = staff(idx).tCnt + 1
        Next i
    Next d
End Sub

Sub SortByCount(elig() As Integer, nElig As Integer, staff() As StaffRec)
    Dim i As Integer, j As Integer, tmp As Integer
    For i = 0 To nElig - 2
        For j = i + 1 To nElig - 1
            If staff(elig(j)).tCnt < staff(elig(i)).tCnt Then
                tmp = elig(i): elig(i) = elig(j): elig(j) = tmp
            End If
        Next j
    Next i
End Sub

' ---- Write schedule sheet -----------------------------------------------
Sub WriteSchedule(staff() As StaffRec, nStaff As Integer, _
                  mStaff() As String, mCnt() As Integer, _
                  eStaff() As String, eCnt() As Integer, startDt As Date)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = Worksheets(SH_SCHED)
    If ws Is Nothing Then
        Set ws = Worksheets.Add(After:=Worksheets(Worksheets.Count))
        ws.Name = SH_SCHED
    End If
    On Error GoTo 0
    ws.Cells.Clear

    ' Title
    ws.Range("A1").Value = "Schedule (14 Days)"
    With ws.Range("A1")
        .Font.Bold = True: .Font.Size = 14
    End With

    ' Headers
    Dim hdr As Variant
    hdr = Array("Date", "Day", "Morning Staff (08:00-12:00)", "M-Count", _
                "Evening Staff (18:00-23:00)", "E-Count")
    Dim c As Integer
    For c = 0 To 5
        ws.Cells(3, c + 1).Value = hdr(c)
    Next c
    With ws.Range("A3:F3")
        .Font.Bold = True
        .Interior.Color = RGB(68, 114, 196)
        .Font.Color = RGB(255, 255, 255)
    End With

    Dim DOW(0 To 6) As String
    DOW(0)="Sun": DOW(1)="Mon": DOW(2)="Tue": DOW(3)="Wed"
    DOW(4)="Thu": DOW(5)="Fri": DOW(6)="Sat"

    Dim d As Integer, k As Integer
    For d = 0 To DAYS - 1
        Dim rn As Integer: rn = 4 + d
        Dim dt As Date: dt = startDt + d
        Dim dw As Integer: dw = Weekday(dt, vbSunday) - 1

        ws.Cells(rn, 1).Value = dt
        ws.Cells(rn, 1).NumberFormat = "yyyy/mm/dd"
        ws.Cells(rn, 2).Value = DOW(dw)

        Dim ms As String: ms = ""
        For k = 0 To mCnt(d) - 1
            If ms <> "" Then ms = ms & ", "
            ms = ms & mStaff(d, k)
        Next k
        ws.Cells(rn, 3).Value = ms
        ws.Cells(rn, 4).Value = mCnt(d)

        Dim es As String: es = ""
        For k = 0 To eCnt(d) - 1
            If es <> "" Then es = es & ", "
            es = es & eStaff(d, k)
        Next k
        ws.Cells(rn, 5).Value = es
        ws.Cells(rn, 6).Value = eCnt(d)

        If dw = 0 Or dw = 6 Then
            ws.Range(ws.Cells(rn,1), ws.Cells(rn,6)).Interior.Color = RGB(255,242,204)
        End If
    Next d

    ws.Columns("A:F").AutoFit
End Sub

' ---- Write staff coverage matrix ----------------------------------------
Sub WriteStaffMatrix(staff() As StaffRec, nStaff As Integer, _
                     mStaff() As String, mCnt() As Integer, _
                     eStaff() As String, eCnt() As Integer, startDt As Date)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = Worksheets(SH_COV)
    If ws Is Nothing Then
        Set ws = Worksheets.Add(After:=Worksheets(Worksheets.Count))
        ws.Name = SH_COV
    End If
    On Error GoTo 0
    ws.Cells.Clear

    ws.Range("A1").Value = "Staff Coverage Matrix"
    With ws.Range("A1")
        .Font.Bold = True: .Font.Size = 14
    End With

    Dim DOW(0 To 6) As String
    DOW(0)="Su": DOW(1)="Mo": DOW(2)="Tu": DOW(3)="We"
    DOW(4)="Th": DOW(5)="Fr": DOW(6)="Sa"

    ws.Cells(3, 1).Value = "Name"
    Dim d As Integer
    For d = 0 To DAYS - 1
        Dim dt As Date: dt = startDt + d
        Dim dw As Integer: dw = Weekday(dt, vbSunday) - 1
        ws.Cells(3, 2 + d).Value = Format(dt, "mm/dd") & Chr(10) & DOW(dw)
        ws.Cells(3, 2 + d).WrapText = True
    Next d
    ws.Cells(3, 2 + DAYS).Value = "M-Shifts"
    ws.Cells(3, 3 + DAYS).Value = "E-Shifts"
    ws.Cells(3, 4 + DAYS).Value = "Total"

    With ws.Rows(3)
        .Font.Bold = True
        .Interior.Color = RGB(68, 114, 196)
        .Font.Color = RGB(255, 255, 255)
    End With

    Dim i As Integer, k As Integer
    For i = 0 To nStaff - 1
        Dim rn As Integer: rn = 4 + i
        ws.Cells(rn, 1).Value = staff(i).sName

        For d = 0 To DAYS - 1
            Dim inM As Boolean: inM = False
            Dim inE As Boolean: inE = False
            For k = 0 To mCnt(d) - 1
                If mStaff(d, k) = staff(i).sName Then inM = True
            Next k
            For k = 0 To eCnt(d) - 1
                If eStaff(d, k) = staff(i).sName Then inE = True
            Next k
            Dim cv As String: cv = ""
            If inM And inE Then
                cv = "B"
                ws.Cells(rn, 2+d).Interior.Color = RGB(155,194,230)
            ElseIf inM Then
                cv = "M"
                ws.Cells(rn, 2+d).Interior.Color = RGB(198,224,180)
            ElseIf inE Then
                cv = "E"
                ws.Cells(rn, 2+d).Interior.Color = RGB(248,203,173)
            End If
            ws.Cells(rn, 2+d).Value = cv
        Next d

        ws.Cells(rn, 2+DAYS).Value = staff(i).mCnt
        ws.Cells(rn, 3+DAYS).Value = staff(i).eCnt
        ws.Cells(rn, 4+DAYS).Value = staff(i).tCnt
    Next i

    ws.Columns("A:R").AutoFit
End Sub
`;

// ═══════════════════════════════════════════════════════════════════════════════
// Build vbaProject.bin
// ═══════════════════════════════════════════════════════════════════════════════
function buildVbaProject(moduleName, vbaSource) {
  const srcBuf      = Buffer.from(vbaSource, 'ascii');
  const compSrc     = ovbaCompress(srcBuf);
  const moduleOffset = 0; // compressed code starts at byte 0 of module stream

  const dirUncomp  = buildDirStream(moduleName, moduleOffset);
  const compDir    = ovbaCompress(dirUncomp);

  // Minimal _VBA_PROJECT stream (2 bytes = performance cache indicator)
  const vbaProjectStream = Buffer.from([0xCC, 0x61]);

  const cfb = CFB.utils.cfb_new({ root: 'Root Entry' });

  // Add VBA storage and streams
  CFB.utils.cfb_add(cfb, 'VBA', null);   // storage
  CFB.utils.cfb_add(cfb, `VBA/${moduleName}`, compSrc);
  CFB.utils.cfb_add(cfb, 'VBA/dir',           compDir);
  CFB.utils.cfb_add(cfb, 'VBA/_VBA_PROJECT',  vbaProjectStream);

  return Buffer.from(CFB.write(cfb, { type: 'buffer' }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Build Excel workbook
// ═══════════════════════════════════════════════════════════════════════════════
function buildWorkbook() {
  const wb = XLSX.utils.book_new();

  // ── Guide sheet ──────────────────────────────────────────────────────────────
  const guideData = [
    ['Scheduling System — Excel VBA Edition'],
    [''],
    ['SHEETS:'],
    ['  Staff    — Enter staff names, gender, backup flag, and daily shift types'],
    ['  Config   — Set start date and store count'],
    ['  Schedule — Generated schedule (click Generate button)'],
    ['  StaffCov — Staff coverage matrix (generated)'],
    [''],
    ['STAFF SHEET — Shift type codes per day:'],
    ['  B = Both morning and evening'],
    ['  M = Morning only (08:00-12:00)'],
    ['  E = Evening only (18:00-23:00)'],
    ['  (leave blank = day off)'],
    [''],
    ['HOW TO RUN:'],
    ['  1. Fill in staff names and shift availability in the Staff sheet'],
    ['  2. Set start date in Config!B2'],
    ['  3. Press Alt+F8, select GenerateSchedule, click Run'],
    ['     (or add a button: Developer > Insert > Button > assign GenerateSchedule)'],
    [''],
    ['NOTE: Enable macros when opening this file.'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
  wsGuide['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Guide');

  // ── Staff sheet ───────────────────────────────────────────────────────────────
  const days14 = Array.from({ length: 14 }, (_, i) => `Day${i + 1}`);
  const staffHeader = ['Name', 'Gender', 'Backup(yes/no)', ...days14];
  const staffRows   = [
    staffHeader,
    ['(shift codes: B=both  M=morning  E=evening  blank=off)'],
    ['Alice',   'F', '',  'B','B','B','B','B','B','B','B','B','B','B','B','B','B'],
    ['Bob',     'M', '',  'M','M','M','M','M','M','M','M','M','M','M','M','M','M'],
    ['Carol',   'F', '',  'E','E','E','E','E','E','E','E','E','E','E','E','E','E'],
    ['David',   'M', '',  'B','B', '','B','B', '','B','B', '','B','B', '','B','B'],
    ['Eve',     'F', '',  'B','B','B', '','B','B','B', '','B','B','B', '','B','B'],
  ];
  const wsStaff = XLSX.utils.aoa_to_sheet(staffRows);
  wsStaff['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 14 },
    ...Array(14).fill({ wch: 6 })];
  XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff');

  // ── Config sheet ──────────────────────────────────────────────────────────────
  const configData = [
    ['Setting', 'Value'],
    ['Start Date', '2026-05-12'],
    ['Store Count', 28],
    [''],
    ['Tips:'],
    ['Enter start date in B2 (YYYY-MM-DD or any date format Excel accepts)'],
  ];
  const wsConfig = XLSX.utils.aoa_to_sheet(configData);
  wsConfig['!cols'] = [{ wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsConfig, 'Config');

  // ── Schedule placeholder ──────────────────────────────────────────────────────
  const wsSchedule = XLSX.utils.aoa_to_sheet([
    ['(Run GenerateSchedule macro to populate this sheet)'],
  ]);
  XLSX.utils.book_append_sheet(wb, wsSchedule, 'Schedule');

  // ── StaffCov placeholder ──────────────────────────────────────────────────────
  const wsStaffCov = XLSX.utils.aoa_to_sheet([
    ['(Run GenerateSchedule macro to populate this sheet)'],
  ]);
  XLSX.utils.book_append_sheet(wb, wsStaffCov, 'StaffCov');

  return wb;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════
const vbaBin = buildVbaProject('Module1', VBA_CODE);
const wb     = buildWorkbook();
wb.vbaraw    = vbaBin;

const outPath = './schedule_system.xlsm';
XLSX.writeFile(wb, outPath, { bookType: 'xlsm' });

const stat = fs.statSync(outPath);
console.log(`Generated: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
console.log('Open in Excel with macros enabled.');
