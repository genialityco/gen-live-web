// src/api/orgs.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "../core/api";
import type { RegistrationForm } from "../types";

export interface BrandingColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface BrandingHeader {
  enabled?: boolean;
  backgroundImageUrl?: string;
  backgroundImageMobileUrl?: string;
}

export interface BrandingFooter {
  enabled?: boolean;
  backgroundImageUrl?: string;
  backgroundImageMobileUrl?: string;
}

export interface BrandingConfig {
  logoUrl?: string;
  colors?: BrandingColors;
  header?: BrandingHeader;
  footer?: BrandingFooter;
}

// Re-exportar desde types.ts para compatibilidad
export type {
  RegistrationForm,
  FormField,
  FormFieldOption,
  FormFieldType,
} from "../types";

export type Org = {
  _id: string;
  name: string;
  domainSlug: string;
  ownerUid: string;
  description?: string;
  branding?: BrandingConfig;
  registrationForm?: RegistrationForm;
};

export async function createOrg(payload: {
  name: string;
  domainSlug: string;
  branding?: any;
}) {
  const { data } = await api.post("/orgs", payload);
  return data as Org;
}

export async function fetchMyOrgs() {
  const { data } = await api.get("/orgs/mine");
  return data as Org[];
}

export async function fetchPublicOrgs() {
  const { data } = await api.get("/orgs/public");
  return data as Org[];
}

export async function fetchOrgBySlug(slug: string) {
  const { data } = await api.get(`/orgs/slug/${slug}`);
  return data as Org;
}

export async function fetchOrgBySlugForAdmin(slug: string) {
  const { data } = await api.get(`/orgs/slug/${slug}/admin`);
  return data as Org;
}

export async function updateOrgBranding(
  slug: string,
  branding: Partial<BrandingConfig>
) {
  const { data } = await api.patch(`/orgs/slug/${slug}/branding`, branding);
  return data as Org;
}

export async function uploadBrandingImage(
  slug: string,
  folder: string,
  file: File
) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post(
    `/orgs/slug/${slug}/upload/${folder}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return data as { url: string };
}

export async function updateRegistrationForm(
  slug: string,
  form: RegistrationForm
) {
  const { data } = await api.patch(
    `/orgs/slug/${slug}/registration-form`,
    form
  );
  return data as Org;
}

export async function fetchRegistrationForm(slug: string) {
  const { data } = await api.get(`/orgs/slug/${slug}/registration-form`);
  return data as RegistrationForm;
}

export async function updateOrganization(
  slug: string,
  payload: { name?: string; description?: string }
) {
  const { data } = await api.patch(`/orgs/slug/${slug}`, payload);
  return data as Org;
}

//registro avanzado de OrgAttendee (org-only / update)
export interface RegisterOrgAttendeeAdvancedPayload {
  attendeeId?: string; // opcional (update)
  email: string;
  name?: string;
  phone?: string;
  formData: Record<string, any>; // registrationData completo (formData en backend)
  firebaseUID?: string;
  metadata?: Record<string, any>;
}

export async function registerOrgAttendeeAdvanced(
  organizationId: string,
  payload: RegisterOrgAttendeeAdvancedPayload
) {
  const { data } = await api.post("/org-attendees/advanced-register", {
    organizationId,
    ...payload,
  });

  // data = OrgAttendee actualizado/creado
  return data as any;
}
