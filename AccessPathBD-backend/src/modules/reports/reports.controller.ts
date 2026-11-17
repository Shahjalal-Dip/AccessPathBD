import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { appConfig } from "@/config/app.config";
import {
  CurrentUser,
  OptionalCurrentUser,
} from "@/common/decorators/current-user.decorator";
import { JwtGuard, OptionalJwtGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import {
  CreateReportDto,
  HistoryQueryDto,
  ListMyReportsQueryDto,
  UpdateReportDto,
} from "@/modules/reports/dto/report.dto";
import { evidenceMulterOptions } from "@/modules/reports/evidence-upload";
import { ReportsService } from "@/modules/reports/reports.service";

@ApiTags("Reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @UseGuards(JwtGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.create(user, dto);
  }

  // NOTE: declared before ":id" so "mine" is not parsed as an id
  @UseGuards(JwtGuard)
  @Get("mine")
  mine(@CurrentUser() user: AuthUser, @Query() q: ListMyReportsQueryDto) {
    return this.reports.listMine(user, q);
  }

  @UseGuards(JwtGuard)
  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.reports.getOne(user, id);
  }

  @UseGuards(JwtGuard)
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reports.update(user, id, dto);
  }

  @UseGuards(JwtGuard)
  @HttpCode(200)
  @Post(":id/withdraw")
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.reports.withdraw(user, id);
  }

  @UseGuards(JwtGuard)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: { type: "array", items: { type: "string", format: "binary" } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor(
      "files",
      appConfig.env.UPLOAD_MAX_FILES_PER_REPORT,
      evidenceMulterOptions(),
    ),
  )
  @Post(":id/evidence")
  addEvidence(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.reports.addEvidence(user, id, files);
  }

  /** Public for approved reports; owner/staff only while the report is open. */
  @UseGuards(OptionalJwtGuard)
  @Get(":id/evidence/:evidenceId/file")
  async file(
    @OptionalCurrentUser() user: AuthUser | null,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("evidenceId", ParseUUIDPipe) evidenceId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mimeType, isPublic } = await this.reports.openEvidence(
      user,
      id,
      evidenceId,
    );
    res.setHeader(
      "Cache-Control",
      isPublic ? "public, max-age=3600" : "private, no-store",
    );
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: "inline",
    });
  }
}

@ApiTags("Buildings")
@Controller("buildings/:id/history")
export class BuildingHistoryController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  history(@Param("id", ParseUUIDPipe) id: string, @Query() q: HistoryQueryDto) {
    return this.reports.publicHistory(id, q);
  }
}
