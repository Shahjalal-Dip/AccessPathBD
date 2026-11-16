import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { JwtGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { SavedService } from "@/modules/saved/saved.service";

@ApiTags("Saved buildings")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("saved")
export class SavedController {
  constructor(private readonly saved: SavedService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationQueryDto) {
    return this.saved.list(user.id, q);
  }

  @Get("ids")
  ids(@CurrentUser() user: AuthUser) {
    return this.saved.ids(user.id);
  }

  @Put(":buildingId")
  save(
    @CurrentUser() user: AuthUser,
    @Param("buildingId", ParseUUIDPipe) id: string,
  ) {
    return this.saved.save(user.id, id);
  }

  @Delete(":buildingId")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("buildingId", ParseUUIDPipe) id: string,
  ) {
    return this.saved.remove(user.id, id);
  }
}
