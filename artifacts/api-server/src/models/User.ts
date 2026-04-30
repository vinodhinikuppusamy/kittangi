import { Schema, model, type Document, type Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
  passwordSalt: string;
  passwordHash: string;
  createdAtIso: string;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: ["ADMIN", "STAFF"], required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    passwordSalt: { type: String, required: true },
    passwordHash: { type: String, required: true },
    createdAtIso: { type: String, required: true },
  },
  { collection: "users" },
);

export const User = model<IUser>("User", userSchema);
