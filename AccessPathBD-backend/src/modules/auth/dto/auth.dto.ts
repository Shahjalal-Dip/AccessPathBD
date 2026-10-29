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
import { ApiProperty } from "@nestjs/swagger";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim) 
  @IsString() 
  @Length(2, 120) 
  @ApiProperty()
  fullName!: string;

  @Transform(normalizeEmail) 
  @IsEmail() 
  @MaxLength(254) 
  @ApiProperty()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: "password must contain at least one letter and one number",
  })
  @ApiProperty()
  password!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  @ApiProperty()
  affiliation?: string;
}

export class LoginDto {
  @Transform(normalizeEmail) 
  @IsEmail() 
  @MaxLength(254) 
  @ApiProperty()
  email!: string;
  @IsString() 
  @MinLength(1) 
  @MaxLength(128) 
  @ApiProperty()
  password!: string;
}
