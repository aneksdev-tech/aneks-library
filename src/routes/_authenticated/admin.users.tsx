import {
  createFileRoute,
  Outlet,
} from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/admin/users",
)({
  component: UsersLayout,
});

function UsersLayout() {
  return <Outlet />;
}