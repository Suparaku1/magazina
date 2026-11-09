import { describe, expect, it } from "vitest";
import { consolidate, workbookBytes, type Line } from "@/lib/excel";
import ExcelJS from "exceljs";
const line = (item_id: string, cmim_njesi: number | null, sasia = 2): Line => ({ item_id, teacher_id: "teacher", curriculum_id: null, sasia, cmim_njesi, sasia_miratuar: 1, sasia_dorezuar: 0 });
describe("Excel business rules", () => {
  it("consolidates by item_id, keeping distinct items separate", () => {
    const rows = consolidate([line("a", 5), line("a", 5, 3), line("b", 5)]);
    expect(rows).toHaveLength(2); expect(rows.find((r) => r.id === "a")?.sasia).toBe(5); expect(rows.find((r) => r.id === "b")?.sasia).toBe(2);
  });
  it("unknown prices stay null and are counted separately", () => {
    const [r] = consolidate([line("a", null)]); expect(r?.vlera).toBeNull(); expect(r?.cmime_mungojne).toBe(1);
  });
  it("known values do not silently include unknown prices as zero", () => {
    const [r] = consolidate([line("a", null), line("a", 5, 3)]); expect(r?.vlera).toBe(15); expect(r?.cmime_mungojne).toBe(1);
  });
  it("xlsx preserves blank unknown prices and concrete quantities", async () => {
    const bytes = await workbookBytes("Test", [{ Artikulli: "a", Sasia: 2, "Çmimi (Lek)": null }, { Artikulli: "b", Sasia: 3, "Çmimi (Lek)": 5 }]);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes); const ws = wb.worksheets[0]; expect(ws?.getCell("C2").value).toBeNull(); expect(ws?.getCell("C3").value).toBe(5); expect(ws?.getCell("B2").value).toBe(2);
  });
});