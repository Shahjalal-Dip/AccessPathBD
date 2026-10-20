import { detectImageType } from "@/common/utilities/file-signature.util";

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP by content", () => {
    expect(
      detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.mime,
    ).toBe("image/jpeg");
    expect(
      detectImageType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
      )?.mime,
    ).toBe("image/png");
    expect(
      detectImageType(Buffer.from("RIFF\0\0\0\0WEBP", "ascii"))?.mime,
    ).toBe("image/webp");
  });

  it("rejects text, scripts and empty files even if named .png", () => {
    expect(
      detectImageType(Buffer.from("<script>alert(1)</script>")),
    ).toBeNull();
    expect(detectImageType(Buffer.from("MZ executable header"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
