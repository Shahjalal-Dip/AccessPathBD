import { DataSource } from "typeorm";
import { dataSourceOptions } from "./database.config";

/** Used only by the TypeORM CLI (migration:generate). */
export default new DataSource(dataSourceOptions);
