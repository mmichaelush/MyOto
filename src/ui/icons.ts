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
