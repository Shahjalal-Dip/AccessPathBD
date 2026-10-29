import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const PASSWORD_MSG = "password must contain at least one letter and one number";

export class UpdateProfileDto {
  @IsOptional() 
  @Transform(trim) 
  @IsString() 
  @Length(2, 120) 
  @ApiProperty()
  fullName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  @ApiProperty()
  affiliation?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  @ApiProperty()
  institution?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^$|^[+0-9 ()-]{6,30}$/, {
    message: "phone must be a valid phone number",
  })
  @ApiProperty()
  phone?: string;

  @IsOptional() 
  @IsIn(["en", "bn"]) 
  @ApiProperty()
  preferredLanguage?: string;

  @IsOptional()
  @ApiProperty() 
  @IsIn(["standard", "large", "x-large"]) 
  textSize?: string;

  @ApiProperty()
  @IsOptional() 
  @IsBoolean() 
  highContrast?: boolean;

  @ApiProperty()
  @IsOptional() 
  @IsBoolean() 
  reduceMotion?: boolean;
}

export class ChangePasswordDto {
  @IsString() 
  @MinLength(1) 
  @MaxLength(128)
  @ApiProperty() 
  currentPassword!: string;
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @ApiProperty()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  newPassword!: string;
}

export class ForgotPasswordDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  @ApiProperty()
  email!: string;
}

export class ResetPasswordDto {
  @IsString() 
  @Length(32, 200) 
  @ApiProperty()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  @ApiProperty()
  password!: string;
}

export class VerifyEmailDto {
  @IsString() 
  @Length(32, 200) 
  @ApiProperty()
  token!: string;
}
