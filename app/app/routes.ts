import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  layout("routes/_layout.tsx", [
    index("routes/index-page.tsx"),
    route("sso/:provider/callback", "routes/sso-github-callback-page.tsx"),
    route("2fa/totp", "routes/2fa-totp-page.tsx"),
    route("t/new", "routes/new-tool-page.tsx"),
    route("t/:toolId", "routes/tool-useage-page.tsx"),
    route("t/:toolId/edit", "routes/tool-edit-page.tsx"),
  ]),
] satisfies RouteConfig;
