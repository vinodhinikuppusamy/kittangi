import { Schema, model, type Document, type Types } from "mongoose";

export interface IBranchProfile extends Document {
  _id: Types.ObjectId;
  branchName: string;
  branchCode?: string;
  address?: string;
  contact?: string;
  phone?: string;
  email?: string;
  logoDataUrl?: string;
  gstin?: string;
  licenseNo?: string;
}

const branchProfileSchema = new Schema<IBranchProfile>(
  {
    branchName: { type: String, required: true },
    branchCode: String,
    address: String,
    contact: String,
    phone: String,
    email: String,
    logoDataUrl: String,
    gstin: String,
    licenseNo: String,
  },
  { collection: "branchProfile" },
);

export const BranchProfile = model<IBranchProfile>("BranchProfile", branchProfileSchema);
