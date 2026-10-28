import migration0001 from "../../migrations/0001_init.sql";

export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    name: "0001_init",
    sql: migration0001,
  },
];
