import { seeder } from "nestjs-seeder";
import { TypeOrmModule } from "@nestjs/typeorm";
import dataSourceOptions from "@/config/database.config";
import { DemoSeeder } from "@/database/seeders/demo.seeder";

// pnpm seeder:run:dev       -> add demo data (skips if users already exist)
// pnpm seeder:refresh:dev   -> wipe all tables, then add demo data
seeder({
  imports: [TypeOrmModule.forRoot(dataSourceOptions)],
}).run([DemoSeeder]);
