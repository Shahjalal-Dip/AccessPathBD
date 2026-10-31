import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { coverMulterOptions } from "@/modules/buildings/cover-upload";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard, RolesGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { BuildingsService } from "@/modules/buildings/buildings.service";
import {
  CreateBuildingDto,
  ListBuildingsQueryDto,
  UpdateBuildingDto,
} from "@/modules/buildings/dto/building.dto";

@ApiTags("Buildings")
@Controller("buildings")
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  // ---- public ----
  @Get()
  list(@Query() q: ListBuildingsQueryDto) {
    return this.buildings.findAll(q);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.buildings.findOne(id);
  }

  @Get(":id/features")
  features(@Param("id", ParseUUIDPipe) id: string) {
    return this.buildings.getFeatures(id);
  }

  /** Public image. Cacheable for a long time because the URL changes (?v=) when the photo changes. */
  @Get(":id/cover")
  async cover(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mimeType } = await this.buildings.openCover(id);
    res.setHeader("Cache-Control", "public, max-age=604800");
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: "inline",
    });
  }

  // ---- admin only ----
  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateBuildingDto, @CurrentUser() user: AuthUser) {
    return this.buildings.create(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateBuildingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.buildings.update(id, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(FileInterceptor("file", coverMulterOptions()))
  @Post(":id/cover")
  setCover(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.buildings.setCover(user, id, file);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @Delete(":id/cover")
  removeCover(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.buildings.removeCover(user, id);
  }
}
