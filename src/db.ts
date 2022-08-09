import { sdk, config } from "./deps.ts";

const api = new sdk.Client()
const db = new sdk.Databases(api, 'main')
const teams = new sdk.Teams(api);
const users = new sdk.Users(api);
const env = config()

api
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT)
  .setKey(env.APPWRITE_KEY)

export { api, db, teams, users, env };