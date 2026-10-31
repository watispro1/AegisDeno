/**
 * Server-rendered HTML for the web dashboard. Every dynamic value goes through
 * `esc()`; nothing here reads the request directly. Each page lives in its own
 * module under this folder; this index keeps the `./views` import surface stable.
 */
export { type Viewer, type GuildContext, type GuildSection } from "./layout";
export { renderNotConfigured, renderLanding, renderError, renderPicker } from "./public";
export { renderOverview } from "./overview";
export { casesQuery, renderCases, renderCase } from "./cases";
export { type FormState, settingsValues, MULTI_FIELDS, submittedValues, hiddenChannelNote } from "./form";
export { renderSettings } from "./settings";
export { renderAppeals, renderAppeal } from "./appeals";
export { type PanelsState, renderPanels } from "./panels";
export { auditLabel, renderActivity } from "./activity";
