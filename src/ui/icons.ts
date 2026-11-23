import carFront from 'lucide-static/icons/car-front.svg?raw';
import clipboardCheck from 'lucide-static/icons/clipboard-check.svg?raw';
import settings from 'lucide-static/icons/settings.svg?raw';
import cog from 'lucide-static/icons/cog.svg?raw';
import ruler from 'lucide-static/icons/ruler.svg?raw';
import circleGauge from 'lucide-static/icons/circle-gauge.svg?raw';
import shieldCheck from 'lucide-static/icons/shield-check.svg?raw';
import leaf from 'lucide-static/icons/leaf.svg?raw';
import construction from 'lucide-static/icons/construction.svg?raw';
import busFront from 'lucide-static/icons/bus-front.svg?raw';
import truck from 'lucide-static/icons/truck.svg?raw';
import users from 'lucide-static/icons/users.svg?raw';
import gauge from 'lucide-static/icons/gauge.svg?raw';
import info from 'lucide-static/icons/info.svg?raw';
import chartColumn from 'lucide-static/icons/chart-column.svg?raw';
import triangleAlert from 'lucide-static/icons/triangle-alert.svg?raw';
import history from 'lucide-static/icons/history.svg?raw';
import share2 from 'lucide-static/icons/share-2.svg?raw';
import copy from 'lucide-static/icons/copy.svg?raw';
import printer from 'lucide-static/icons/printer.svg?raw';
import image from 'lucide-static/icons/image.svg?raw';
import star from 'lucide-static/icons/star.svg?raw';
import columns2 from 'lucide-static/icons/columns-2.svg?raw';
import ellipsis from 'lucide-static/icons/ellipsis.svg?raw';
import fileJson from 'lucide-static/icons/file-json.svg?raw';
import download from 'lucide-static/icons/download.svg?raw';
import database from 'lucide-static/icons/database.svg?raw';
import search from 'lucide-static/icons/search.svg?raw';
import chevronDown from 'lucide-static/icons/chevron-down.svg?raw';

import bookOpen from 'lucide-static/icons/book-open.svg?raw';
import accessibility from 'lucide-static/icons/accessibility.svg?raw';
import weight from 'lucide-static/icons/weight.svg?raw';
import fuel from 'lucide-static/icons/fuel.svg?raw';
import palette from 'lucide-static/icons/palette.svg?raw';
import factory from 'lucide-static/icons/factory.svg?raw';
import calendarDays from 'lucide-static/icons/calendar-days.svg?raw';
import fileBadge from 'lucide-static/icons/file-badge.svg?raw';
import fingerprint from 'lucide-static/icons/fingerprint.svg?raw';
import caravan from 'lucide-static/icons/caravan.svg?raw';
import scanLine from 'lucide-static/icons/scan-line.svg?raw';
import airVent from 'lucide-static/icons/air-vent.svg?raw';
import camera from 'lucide-static/icons/camera.svg?raw';
import armchair from 'lucide-static/icons/armchair.svg?raw';
import doorOpen from 'lucide-static/icons/door-open.svg?raw';
import waypoints from 'lucide-static/icons/waypoints.svg?raw';
import wind from 'lucide-static/icons/wind.svg?raw';
import shieldAlert from 'lucide-static/icons/shield-alert.svg?raw';
import trafficCone from 'lucide-static/icons/traffic-cone.svg?raw';
import lightbulb from 'lucide-static/icons/lightbulb.svg?raw';
import personStanding from 'lucide-static/icons/person-standing.svg?raw';
import tag from 'lucide-static/icons/tag.svg?raw';
import wallet from 'lucide-static/icons/wallet.svg?raw';
import batteryCharging from 'lucide-static/icons/battery-charging.svg?raw';
import globe from 'lucide-static/icons/globe.svg?raw';
import zap from 'lucide-static/icons/zap.svg?raw';
import cargoPackage from 'lucide-static/icons/package.svg?raw';
import grip from 'lucide-static/icons/grip.svg?raw';

const symbols: Record<string, string> = {
  'car-front': carFront,
  'clipboard-check': clipboardCheck,
  settings: settings,
  cog: cog,
  ruler: ruler,
  'circle-gauge': circleGauge,
  'shield-check': shieldCheck,
  leaf: leaf,
  construction: construction,
  'bus-front': busFront,
  truck: truck,
  users: users,
  gauge: gauge,
  info: info,
  'chart-column': chartColumn,
  'triangle-alert': triangleAlert,
  history: history,
  'share-2': share2,
  copy: copy,
  printer: printer,
  image: image,
  star: star,
  'columns-2': columns2,
  ellipsis: ellipsis,
  'file-json': fileJson,
  download: download,
  database: database,
  search: search,
  'chevron-down': chevronDown,
  'book-open': bookOpen,
  accessibility: accessibility,
  weight: weight,
  fuel: fuel,
  palette: palette,
  factory: factory,
  'calendar-days': calendarDays,
  'file-badge': fileBadge,
  fingerprint: fingerprint,
  caravan: caravan,
  'scan-line': scanLine,
  'air-vent': airVent,
  camera: camera,
  armchair: armchair,
  'door-open': doorOpen,
  waypoints: waypoints,
  wind: wind,
  'shield-alert': shieldAlert,
  'traffic-cone': trafficCone,
  lightbulb: lightbulb,
  'person-standing': personStanding,
  tag: tag,
  wallet: wallet,
  'battery-charging': batteryCharging,
  globe: globe,
  zap: zap,
  package: cargoPackage,
  grip,
};

export function icon(name: string) {
  const container = document.createElement('template');
  // The markup comes exclusively from the local Lucide package.
  container.innerHTML = symbols[name] ?? info;
  const svg = container.content.firstElementChild as SVGSVGElement;
  svg.classList.add('ui-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}
export function mark<T extends HTMLElement>(node: T, name: string) {
  node.prepend(icon(name));
  node.classList.add('with-icon');
  return node;
}
