import { Schema, model, type Document, type Types } from "mongoose";

export interface IVaultConfig extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  subtitle: string;
  prefix: string;
  startNumber: number;
  lockerCount: number;
}

const vaultConfigSchema = new Schema<IVaultConfig>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subtitle: { type: String, required: true },
    prefix: { type: String, required: true },
    startNumber: { type: Number, required: true },
    lockerCount: { type: Number, required: true },
  },
  { collection: "vaultConfig" },
);

export const VaultConfig = model<IVaultConfig>("VaultConfig", vaultConfigSchema);
