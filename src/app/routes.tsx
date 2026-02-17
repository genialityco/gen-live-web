import { lazy } from "react";
import AdminRoute from "../auth/guards/AdminRoute";
import PublicAnonGate from "../auth/guards/PublicAnonGate";
import Layout from "../components/common/Layout";
import OrgAccess from "../pages/organizations/OrgAccess";
import { StudioPage } from "../pages/studio/StudioPage";
import { SpeakerInvitePage } from "../pages/studio/SpeakerInvitePage";
import { LiveViewerPage } from "../pages/viewer/LiveViewerPage";
import EventAttendGcore from "../pages/events/EventAttendGcore";
import LkEgressProgram from "../pages/studio/LkEgressProgram";

// Lazy imports
const Home = lazy(() => import("../pages/home/Home"));
const AdminAuth = lazy(() => import("../pages/auth/AdminAuth"));
const OrganizationsList = lazy(
  () => import("../pages/organizations/OrganizationsList")
);
const OrganizationLanding = lazy(
  () => import("../pages/organizations/OrganizationLanding")
);
const OrganizationAdmin = lazy(
  () => import("../pages/organizations/OrganizationAdmin")
);
const EventAdmin = lazy(() => import("../pages/events/EventAdmin"));
const EventLanding = lazy(() => import("../pages/events/EventLanding"));
// const EventAttend = lazy(() => import("../pages/events/EventAttend"));

export const routes = [
  {
    path: "/",
    element: (
      <Layout>
        <PublicAnonGate>
          <Home />
        </PublicAnonGate>
      </Layout>
    ),
  },
  {
    path: "/lk-egress",
    element: <LkEgressProgram />,
  },
  {
    path: "/studio/:eventSlug/join",
    element: <SpeakerInvitePage />,
  },
  {
    path: "/studio/:eventSlug/speaker/:inviteToken",
    element: <SpeakerInvitePage />,
  },
  {
    path: "/organizations",
    element: (
      <Layout>
        <OrganizationsList />
      </Layout>
    ),
  },
  {
    path: "/org/:slug",
    element: <OrganizationLanding />,
  },
  {
    path: "/org/:slug/access",
    element: <OrgAccess />,
  },
  {
    path: "/org/:slug/event/:eventSlug",
    element: <EventLanding />,
  },
  {
    path: "/org/:slug/event/:eventSlug/attend",
    element: <EventAttendGcore />,
  },
  {
    path: "/org/:slug/event/:eventSlug/live",
    element: <LiveViewerPage />,
  },
  {
    path: "/admin-auth",
    element: (
      <Layout>
        <AdminAuth />
      </Layout>
    ),
  },
  {
    element: <AdminRoute />, // protege todo lo interno
    children: [
      {
        path: "/org/admin", // Ruta para crear organización
        element: (
          <Layout>
            <OrganizationAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/admin",
        element: (
          <Layout>
            <OrganizationAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/admin/events",
        element: (
          <Layout>
            <OrganizationAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/admin/attendees",
        element: (
          <Layout>
            <OrganizationAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/admin/registration-form",
        element: (
          <Layout>
            <OrganizationAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/admin/settings",
        element: (
          <Layout>
            <OrganizationAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin",
        element: (
          <Layout>
            <EventAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin/control",
        element: (
          <Layout>
            <EventAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin/attendees",
        element: (
          <Layout>
            <EventAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin/settings",
        element: (
          <Layout>
            <EventAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin/chat",
        element: (
          <Layout>
            <EventAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin/metrics",
        element: (
          <Layout>
            <EventAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin/polls",
        element: (
          <Layout>
            <EventAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin/email",
        element: (
          <Layout>
            <EventAdmin />
          </Layout>
        ),
      },
      {
        path: "/org/:slug/event/:eventSlug/admin/studio",
        element: (
          <Layout>
            <StudioPage />
          </Layout>
        ),
      },
    ],
  },
];
