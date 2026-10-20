import { Transform } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim) @IsString() @Length(2, 120) fullName!: string;

  @Transform(normalizeEmail) @IsEmail() @MaxLength(254) email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "password must contain at least one letter and one number",
  })
  password!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  affiliation?: string;
}

export class LoginDto {
  @Transform(normalizeEmail) @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
