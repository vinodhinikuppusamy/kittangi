import { Schema, model, type Document, type Types } from "mongoose";

export interface IBranchProfile extends Document {
  _id: Types.ObjectId;
  branchName: string;
  address?: string;
  phone?: string;
  email?: string;
  logoDataUrl?: string;
  gstin?: string;
  licenseNo?: string;
}

const branchProfileSchema = new Schema<IBranchProfile>(
  {
    branchName: { type: String, required: true },
    address: String,
    phone: String,
    email: String,
    logoDataUrl: String,
    gstin: String,
    licenseNo: String,
  },
  { collection: "branchProfile" },
);

export const BranchProfile = model<IBranchProfile>("BranchProfile", branchProfileSchema);
