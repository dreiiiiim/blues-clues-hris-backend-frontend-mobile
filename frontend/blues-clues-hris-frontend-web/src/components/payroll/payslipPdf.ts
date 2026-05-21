import type { ComputedPayslip, PayslipBreakdown, PayslipDetail } from "@/lib/payrollApi";

const toCurrencyNumber = (value: number | string) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

function escapePdfText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

export function formatPayslipPeriod(payslip: PayslipDetail | ComputedPayslip) {
  if (payslip.period) {
    const start = new Date(payslip.period.cutoff_start_date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
    });
    const end = new Date(payslip.period.cutoff_end_date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} - ${end}`;
  }

  return new Date(payslip.created_at).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type PayslipExportContext = {
  companyName: string;
  employeeName: string;
  employeeEmail: string;
  employeeId: string | null;
  payFrequency: string | null;
};

export function downloadPayslipPdf(
  payslip: PayslipDetail | ComputedPayslip,
  context: PayslipExportContext,
) {
  const breakdown = payslip.breakdown as PayslipBreakdown | null;
  const attendance = breakdown?.attendance ?? null;
  const basicPay = breakdown?.basicPay;
  const payableUnits = basicPay?.units ?? attendance?.payableDays ?? null;
  const scheduledUnits = basicPay?.scheduledUnits ?? attendance?.scheduledDays ?? null;
  const unitLabel = basicPay?.unitLabel ?? "day(s)";
  const unitRate = basicPay?.rate ?? null;

  const earningRows = [
    {
      item: "Basic Pay",
      units:
        payableUnits != null
          ? `${payableUnits}${scheduledUnits != null ? ` / ${scheduledUnits} ${unitLabel}` : ` ${unitLabel}`}`
          : "-",
      rate: unitRate != null ? toCurrencyNumber(unitRate) : "-",
      amount: toCurrencyNumber(payslip.basic_pay_earned),
    },
    ...((breakdown?.benefits ?? []).map((benefit) => ({
      item: benefit.name ?? benefit.type ?? "Benefit",
      units: "-",
      rate: "-",
      amount: toCurrencyNumber(benefit.amount),
    }))),
    ...(!breakdown?.benefits?.length && Number(payslip.total_allowances) > 0
      ? [{ item: "Allowances", units: "-", rate: "-", amount: toCurrencyNumber(payslip.total_allowances) }]
      : []),
    ...(breakdown?.overtime?.hours
      ? [{
          item: "Overtime Pay",
          units: `${breakdown.overtime.hours} hr(s)`,
          rate: `x${breakdown.overtime.multiplier}`,
          amount: toCurrencyNumber(breakdown.overtime.pay),
        }]
      : []),
    ...(breakdown?.nightShift?.hours
      ? [{
          item: "Night Shift Differential",
          units: `${breakdown.nightShift.hours} hr(s)`,
          rate: `x${breakdown.nightShift.multiplier}`,
          amount: toCurrencyNumber(breakdown.nightShift.pay),
        }]
      : []),
    ...(breakdown?.holiday?.dates?.length
      ? [{
          item: "Holiday Premium",
          units: `${breakdown.holiday.dates.length} holiday(s)`,
          rate: "-",
          amount: toCurrencyNumber(breakdown.holiday.pay),
        }]
      : []),
  ];

  const deductionRows = [
    { item: "Income Tax", amount: toCurrencyNumber(payslip.tax_deduction) },
    ...(breakdown?.sss != null
      ? [
          { item: "SSS", amount: toCurrencyNumber(breakdown.sss) },
          { item: "PhilHealth", amount: toCurrencyNumber(breakdown.philhealth) },
          { item: "Pag-IBIG", amount: toCurrencyNumber(breakdown.pagibig) },
        ]
      : [{ item: "Statutory Deductions", amount: toCurrencyNumber(payslip.statutory_deductions) }]),
    ...(breakdown?.lateness?.hours
      ? [{ item: "Late Deduction", amount: toCurrencyNumber(breakdown.lateness.deduction) }]
      : []),
  ];

  const payoutDate = payslip.period?.payout_date
    ? new Date(payslip.period.payout_date).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "-";

  const payFrequencyLabel = context.payFrequency ? context.payFrequency.replace("-", " ") : "-";
  const attendanceNote =
    attendance && (attendance.paidLeaveDays > 0 || attendance.unpaidLeaveDays > 0)
      ? `${attendance.paidLeaveDays > 0 ? `${attendance.paidLeaveDays} paid leave day(s)` : ""}${
          attendance.paidLeaveDays > 0 && attendance.unpaidLeaveDays > 0 ? " | " : ""
        }${attendance.unpaidLeaveDays > 0 ? `${attendance.unpaidLeaveDays} unpaid leave day(s)` : ""}`
      : "";

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const rightColWidth = 205;
  const leftColWidth = contentWidth - rightColWidth - 18;
  const commands: string[] = [];

  const fillColor = (r: number, g: number, b: number) =>
    commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
  const strokeColor = (r: number, g: number, b: number) =>
    commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
  const lineWidth = (width: number) => commands.push(`${width} w`);
  const drawLine = (x1: number, y1: number, x2: number, y2: number) =>
    commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  const drawRect = (x: number, y: number, width: number, height: number, fill = false) =>
    commands.push(`${x} ${y} ${width} ${height} re ${fill ? "B" : "S"}`);
  const drawText = (text: string, x: number, y: number, size = 10) =>
    commands.push(`BT /F1 ${size} Tf 0 0 0 rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`);
  const drawRightText = (text: string, rightX: number, y: number, size = 10) => {
    const safe = text ?? "";
    const estimatedWidth = safe.length * size * 0.48;
    drawText(safe, Math.max(margin, rightX - estimatedWidth), y, size);
  };
  const drawPesoMark = (x: number, y: number, size = 10) => {
    drawText("P", x, y, size);
    const left = x + size * 0.14;
    const right = x + size * 0.52;
    const upperY = y + size * 0.48;
    const lowerY = y + size * 0.32;
    drawLine(left, upperY, right, upperY);
    drawLine(left, lowerY, right, lowerY);
  };
  const drawRightPesoAmount = (amount: string, rightX: number, y: number, size = 10) => {
    const safe = amount ?? "";
    const amountWidth = safe.length * size * 0.48;
    const pesoWidth = size * 0.72;
    const gap = 5;
    const amountX = Math.max(margin, rightX - amountWidth);
    const pesoX = amountX - pesoWidth - gap;
    drawPesoMark(pesoX, y, size);
    drawText(safe, amountX, y, size);
  };

  lineWidth(1);
  strokeColor(0.58, 0.66, 0.72);
  fillColor(1, 1, 1);

  drawText("PAYSLIP", margin, 800, 20);
  drawText("Compensation & Benefits", margin, 784, 11);
  drawText(context.companyName || "Your Company", margin, 764, 16);

  let leftInfoY = 740;
  [
    ["Employee", context.employeeName],
    ["Employee ID", context.employeeId || "-"],
    ["Email", context.employeeEmail || "-"],
    ["Payslip ID", payslip.payslip_code ?? payslip.payslip_id],
    ["Status", payslip.status],
  ].forEach(([label, value]) => {
    drawText(`${label}:`, margin, leftInfoY, 10);
    drawText(value, margin + 78, leftInfoY, 10);
    leftInfoY -= 16;
  });

  const rightX = margin + leftColWidth + 18;
  let rightInfoY = 800;
  [
    ["Pay Date", payoutDate],
    ["Pay Period", formatPayslipPeriod(payslip)],
    ["Pay Frequency", payFrequencyLabel],
    ["Gross Pay", toCurrencyNumber(payslip.gross_pay)],
    ["Total Deductions", toCurrencyNumber(payslip.total_deductions)],
    ["Net Pay", toCurrencyNumber(payslip.net_pay)],
  ].forEach(([label, value]) => {
    drawText(`${label}:`, rightX, rightInfoY, 10);
    if (label === "Pay Frequency" || label === "Pay Date" || label === "Pay Period") {
      drawRightText(value, pageWidth - margin, rightInfoY, 10);
    } else {
      drawRightPesoAmount(value, pageWidth - margin, rightInfoY, 10);
    }
    rightInfoY -= 16;
  });

  const earningsTop = 635;
  const tableCol1 = margin;
  const tableCol2 = tableCol1 + 240;
  const tableCol3 = tableCol2 + 90;
  const tableCol4 = tableCol3 + 80;
  const tableCol5 = pageWidth - margin;
  const rowHeight = 20;

  fillColor(0.86, 0.92, 0.99);
  drawRect(tableCol1, earningsTop, tableCol5 - tableCol1, rowHeight, true);
  fillColor(0, 0, 0);
  drawText("EARNINGS", tableCol1 + 6, earningsTop + 6, 10);
  drawText("HOURS / UNITS", tableCol2 + 6, earningsTop + 6, 9);
  drawText("RATE", tableCol3 + 6, earningsTop + 6, 9);
  drawText("AMOUNT", tableCol4 + 6, earningsTop + 6, 9);

  [tableCol1, tableCol2, tableCol3, tableCol4, tableCol5].forEach((x) =>
    drawLine(x, earningsTop, x, earningsTop - rowHeight * (earningRows.length + 2)),
  );
  drawRect(tableCol1, earningsTop, tableCol5 - tableCol1, -rowHeight * (earningRows.length + 2), false);

  let currentY = earningsTop - rowHeight;
  earningRows.forEach((row) => {
    drawLine(tableCol1, currentY, tableCol5, currentY);
    drawText(row.item, tableCol1 + 6, currentY + 6, 9);
    drawRightText(row.units, tableCol3 - 8, currentY + 6, 9);
    if (row.rate === "-") {
      drawRightText(row.rate, tableCol4 - 8, currentY + 6, 9);
    } else {
      drawRightPesoAmount(row.rate, tableCol4 - 8, currentY + 6, 9);
    }
    drawRightPesoAmount(row.amount, tableCol5 - 8, currentY + 6, 9);
    currentY -= rowHeight;
  });
  drawLine(tableCol1, currentY, tableCol5, currentY);
  drawText("Gross Pay", tableCol1 + 6, currentY + 6, 9);
  drawRightPesoAmount(toCurrencyNumber(payslip.gross_pay), tableCol5 - 8, currentY + 6, 9);
  currentY -= rowHeight;
  drawLine(tableCol1, currentY, tableCol5, currentY);

  const deductionsTop = currentY - 26;
  const deductionCol2 = pageWidth - margin - 120;
  fillColor(0.86, 0.92, 0.99);
  drawRect(tableCol1, deductionsTop, tableCol5 - tableCol1, rowHeight, true);
  fillColor(0, 0, 0);
  drawText("DEDUCTIONS", tableCol1 + 6, deductionsTop + 6, 10);
  drawText("AMOUNT", deductionCol2 + 6, deductionsTop + 6, 9);

  [tableCol1, deductionCol2, tableCol5].forEach((x) =>
    drawLine(x, deductionsTop, x, deductionsTop - rowHeight * (deductionRows.length + 2)),
  );
  drawRect(tableCol1, deductionsTop, tableCol5 - tableCol1, -rowHeight * (deductionRows.length + 2), false);

  currentY = deductionsTop - rowHeight;
  deductionRows.forEach((row) => {
    drawLine(tableCol1, currentY, tableCol5, currentY);
    drawText(row.item, tableCol1 + 6, currentY + 6, 9);
    drawRightPesoAmount(row.amount, tableCol5 - 8, currentY + 6, 9);
    currentY -= rowHeight;
  });
  drawLine(tableCol1, currentY, tableCol5, currentY);
  drawText("Total Deductions", tableCol1 + 6, currentY + 6, 9);
  drawRightPesoAmount(toCurrencyNumber(payslip.total_deductions), tableCol5 - 8, currentY + 6, 9);
  currentY -= rowHeight;
  drawLine(tableCol1, currentY, tableCol5, currentY);

  const summaryTop = currentY - 34;
  const summaryHeight = 74;
  drawRect(tableCol1, summaryTop, tableCol5 - tableCol1, -summaryHeight, false);
  drawLine(tableCol1, summaryTop - 24, tableCol5, summaryTop - 24);
  drawLine(tableCol1, summaryTop - 48, tableCol5, summaryTop - 48);
  drawText("Tax Withheld", tableCol1 + 8, summaryTop - 16, 10);
  drawRightPesoAmount(toCurrencyNumber(payslip.tax_deduction), tableCol5 - 8, summaryTop - 16, 10);
  drawText("Statutory Deductions", tableCol1 + 8, summaryTop - 40, 10);
  drawRightPesoAmount(toCurrencyNumber(payslip.statutory_deductions), tableCol5 - 8, summaryTop - 40, 10);
  fillColor(0.93, 0.99, 0.96);
  drawRect(tableCol1, summaryTop - 48, tableCol5 - tableCol1, -26, true);
  fillColor(0, 0, 0);
  drawText("NET PAY", tableCol1 + 8, summaryTop - 64, 12);
  drawRightPesoAmount(toCurrencyNumber(payslip.net_pay), tableCol5 - 8, summaryTop - 64, 12);

  let footY = summaryTop - 100;
  if (breakdown?.firstPayrollAccumulation && breakdown.coveredPeriodStart && breakdown.coveredPeriodEnd) {
    drawText(
      `First payroll coverage: ${new Date(breakdown.coveredPeriodStart).toLocaleDateString("en-PH")} to ${new Date(breakdown.coveredPeriodEnd).toLocaleDateString("en-PH")}`,
      margin,
      footY,
      9,
    );
    footY -= 14;
  }
  if (attendanceNote) {
    drawText(attendanceNote, margin, footY, 9);
  }

  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `payslip-${formatPayslipPeriod(payslip).replace(/\s+/g, "-").toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
