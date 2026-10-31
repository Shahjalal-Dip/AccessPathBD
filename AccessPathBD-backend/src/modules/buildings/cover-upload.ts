import { BadRequestException } from "@nestjs/common";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { diskStorage } from "multer";
import { resolve } from "path";
import { appConfig } from "@/config/app.config";
import { ALLOWED_IMAGE_MIME } from "@/common/utilities/file-signature.util";

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const coverDir = () => resolve(process.cwd(), appConfig.env.COVER_DIR);

export const coverMulterOptions = (): MulterOptions => ({
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(coverDir(), { recursive: true });
      cb(null, coverDir());
    },
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${EXT[file.mimetype] ?? ".bin"}`),
  }),
  limits: {
    fileSize: Math.floor(appConfig.env.UPLOAD_MAX_FILE_MB * 1024 * 1024),
    files: 1,
  },
  fileFilter: (_req, file, cb) =>
    ALLOWED_IMAGE_MIME.includes(file.mimetype)
      ? cb(null, true)
      : cb(
          new BadRequestException("Only JPEG, PNG and WebP images are allowed"),
          false,
        ),
});
