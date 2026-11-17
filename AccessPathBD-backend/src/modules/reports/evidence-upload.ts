import { BadRequestException } from "@nestjs/common";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { diskStorage } from "multer";
import { appConfig } from "@/config/app.config";
import { ALLOWED_IMAGE_MIME } from "@/common/utilities/file-signature.util";
import { uploadDir } from "@/modules/reports/reports.service";

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Disk storage with server-generated names, a size cap and a type allow-list. */
export const evidenceMulterOptions = (): MulterOptions => ({
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const dir = uploadDir();
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${EXT[file.mimetype] ?? ".bin"}`),
  }),
  limits: {
    fileSize: Math.floor(appConfig.env.UPLOAD_MAX_FILE_MB * 1024 * 1024),
    files: appConfig.env.UPLOAD_MAX_FILES_PER_REPORT,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype))
      return cb(
        new BadRequestException("Only JPEG, PNG and WebP images are allowed"),
        false,
      );
    cb(null, true);
  },
});
