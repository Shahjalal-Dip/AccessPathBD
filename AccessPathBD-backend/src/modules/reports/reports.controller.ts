
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import {
  CurrentUser,
  OptionalCurrentUser,
} from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import {
  JwtGuard,
  OptionalJwtGuard,
  RolesGuard,
} from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

import { ReportsService } from "@/modules/reports/reports.service";
import { CreateReportDto } from "@/modules/reports/dto/create-report.dto";
import { UpdateReportDto } from "@/modules/reports/dto/update-report.dto";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @Get("mine")
  findMine(@CurrentUser() user: AuthUser) {
    return this.reportsService.findMine(user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR, Role.MODERATOR, Role.ADMIN)
  @Get(":id")
  findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.findOne(id, user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @Post()
  create(@Body() dto: CreateReportDto, @CurrentUser() user: AuthUser) {
    return this.reportsService.create(dto, user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.update(id, dto, user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @Post(":id/withdraw")
  withdraw(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.withdraw(id, user);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @Post(":id/evidence")
  @UseInterceptors(
    FilesInterceptor("files", 5, {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5,
      },
    }),
  )
  uploadEvidence(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.uploadEvidence(id, files, user);
  }

  @UseGuards(OptionalJwtGuard)
  @Get(":id/evidence/:eid/file")
  async getEvidenceFile(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("eid", ParseUUIDPipe) eid: string,
    @OptionalCurrentUser() user: AuthUser | null,
  ) {
    const evidence = await this.reportsService.getEvidenceFile(
      id,
      eid,
      user,
    );

    const safeFilename = evidence.originalFilename.replace(
      /["\r\n]/g,
      "_",
    );

    return new StreamableFile(evidence.buffer, {
      type: evidence.mimeType,
      disposition: `inline; filename="${safeFilename}"`,
    });
  }
}
