import type {
  Circuit,
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
} from '@drawmyplace/contracts';

/** Structural drawing shape shared by server and local plans. */
export interface IfcDrawing {
  calibration: { metersPerUnit: number } | null;
  walls: readonly PublicWall[];
  openings: readonly PublicOpening[];
  rooms: readonly PublicRoom[];
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
}

export interface IfcExportInput {
  projectName: string;
  planName?: string | null;
  drawing: IfcDrawing;
  circuits?: readonly Pick<Circuit, 'id' | 'name'>[];
  wallHeightMeters?: number;
}

export interface IfcExportStats {
  walls: number;
  openings: number;
  points: number;
  routes: number;
  rooms: number;
  entities: number;
}

export interface IfcExportResult {
  text: string;
  fileName: string;
  scale: number;
  calibrated: boolean;
  stats: IfcExportStats;
}

export const DEFAULT_IFC_WALL_HEIGHT_M = 2.7;

const IFC_GUID_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

function hash32(value: string, seed: number): number {
  let hash = seed >>> 0;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

function hex32(value: number): string {
  return value.toString(16).padStart(8, '0');
}

/** Deterministic 22-character IFC GlobalId derived from a stable seed. */
export function ifcGuid(seed: string): string {
  const hex =
    hex32(hash32(seed, 0x811c9dc5)) +
    hex32(hash32(seed, 0x9e3779b9)) +
    hex32(hash32(`${seed}:b`, 0x85ebca6b)) +
    hex32(hash32(`${seed}:c`, 0xc2b2ae35));
  let value = BigInt(`0x${hex}`);
  const chars: string[] = [];

  for (let index = 0; index < 22; index += 1) {
    chars.push(IFC_GUID_CHARS[Number(value & 63n)] ?? '0');
    value >>= 6n;
  }

  return chars.reverse().join('');
}

/** STEP string with single-quote doubling and UTF-16 escapes for non-ASCII. */
export function ifcString(value: string): string {
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    const code = value.charCodeAt(index);

    if (char === "'") {
      result += "''";
    } else if (char === '\\') {
      result += '\\\\';
    } else if (code >= 32 && code <= 126) {
      result += char;
    } else {
      result += `\\X2\\${code.toString(16).toUpperCase().padStart(4, '0')}\\X0\\`;
    }
  }

  return `'${result}'`;
}

function number(value: number, digits = 6): string {
  if (!Number.isFinite(value)) return '0.';

  const fixed = value.toFixed(digits);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  const result = trimmed === '-0' ? '0' : trimmed;

  return result.includes('.') ? result : `${result}.`;
}

function safeFileName(value: string): string {
  return (
    value
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'drawmyplace'
  );
}

const guid = (seed: string): string => ifcString(ifcGuid(seed));

class StepWriter {
  private readonly lines: string[] = [];
  private nextId = 0;

  add(entity: string): string {
    this.nextId += 1;
    const id = `#${this.nextId}`;
    this.lines.push(`${id}=${entity};`);
    return id;
  }

  get count(): number {
    return this.nextId;
  }

  render(fileName: string, timestamp: string): string {
    return [
      'ISO-10303-21;',
      'HEADER;',
      "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
      `FILE_NAME(${ifcString(fileName)},${ifcString(timestamp)},('DrawMyPlace'),('DrawMyPlace'),'DrawMyPlace IFC exporter','DrawMyPlace','');`,
      "FILE_SCHEMA(('IFC4'));",
      'ENDSEC;',
      'DATA;',
      ...this.lines,
      'ENDSEC;',
      'END-ISO-10303-21;',
      '',
    ].join('\n');
  }
}

function normalizeDirection(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);

  return length > 1e-12 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

function mountingHeight(route: PublicRoute, wallHeight: number): number {
  switch (route.settings.mounting) {
    case 'ceiling':
      return Math.max(0.3, wallHeight - 0.15);
    case 'floor':
      return 0.05;
    case 'chase':
      return 1.1;
    case 'wall':
      return 1.1;
    default:
      return 1.1;
  }
}

function pointHeight(point: PublicPoint): number {
  if (typeof point.mountingHeight === 'number') return point.mountingHeight;

  switch (point.type) {
    case 'socket':
      return 0.3;
    case 'switch':
      return 1;
    case 'light':
      return 2.4;
    case 'panel':
      return 1.5;
    case 'junction':
      return 0.3;
    default:
      return 1;
  }
}

function pointEntityType(point: PublicPoint): string {
  switch (point.type) {
    case 'socket':
      return 'IFCOUTLET';
    case 'switch':
      return 'IFCSWITCHINGDEVICE';
    case 'light':
      return 'IFCLIGHTFIXTURE';
    case 'panel':
      return 'IFCELECTRICDISTRIBUTIONBOARD';
    case 'junction':
      return 'IFCJUNCTIONBOX';
    default:
      return 'IFCBUILDINGELEMENTPROXY';
  }
}

interface Segment {
  a: { x: number; y: number };
  b: { x: number; y: number };
  length: number;
  startDistance: number;
}

function wallSegments(wall: PublicWall): Segment[] {
  const segments: Segment[] = [];
  let distance = 0;

  for (let index = 1; index < wall.geometry.length; index += 1) {
    const a = wall.geometry[index - 1];
    const b = wall.geometry[index];
    if (!a || !b) continue;

    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length <= 1e-9) continue;

    segments.push({ a, b, length, startDistance: distance });
    distance += length;
  }

  return segments;
}

interface Property {
  name: string;
  value: string | number;
}

/**
 * Builds an IFC4 (STEP) file for one floor plan. The drawing is placed in
 * metres using the calibration scale; walls become extruded solids with
 * opening voids, devices become IFC distribution elements, routes become
 * IfcCableSegment curves and rooms become IfcSpace volumes.
 */
export function buildIfc(input: IfcExportInput): IfcExportResult {
  const drawing = input.drawing;
  const calibrated =
    typeof drawing.calibration?.metersPerUnit === 'number' &&
    drawing.calibration.metersPerUnit > 0;
  const scale = calibrated
    ? (drawing.calibration?.metersPerUnit ?? 0.01)
    : 0.01;
  const wallHeight = input.wallHeightMeters ?? DEFAULT_IFC_WALL_HEIGHT_M;
  const defaultThickness = 0.15;
  const writer = new StepWriter();
  const circuitNames = new Map(
    (input.circuits ?? []).map((circuit) => [circuit.id, circuit.name]),
  );
  const now = Math.floor(Date.now() / 1000);
  const timestamp = new Date().toISOString().slice(0, 19);
  const x = (value: number) => value * scale;
  const y = (value: number) => -value * scale;

  const cartesian = (px: number, py: number, pz?: number) =>
    writer.add(
      pz === undefined
        ? `IFCCARTESIANPOINT((${number(px)},${number(py)}))`
        : `IFCCARTESIANPOINT((${number(px)},${number(py)},${number(pz)}))`,
    );
  const direction = (dx: number, dy: number, dz: number) =>
    writer.add(
      `IFCDIRECTION((${number(dx)},${number(dy)},${number(dz)}))`,
    );
  const axis2 = (px: number, py: number) =>
    writer.add(
      `IFCAXIS2PLACEMENT2D(${cartesian(px, py)},$)` ,
    );
  const axis3 = (
    px: number,
    py: number,
    pz: number,
    dx: number,
    dy: number,
  ) =>
    writer.add(
      `IFCAXIS2PLACEMENT3D(${cartesian(px, py, pz)},${direction(0, 0, 1)},${direction(dx, dy, 0)})`,
    );
  const localPlacement = (
    parent: string | null,
    px: number,
    py: number,
    pz: number,
    dx = 1,
    dy = 0,
  ) =>
    writer.add(
      `IFCLOCALPLACEMENT(${parent ?? '$'},${axis3(px, py, pz, dx, dy)})`,
    );
  const zDirection = direction(0, 0, 1);

  // ----------------------------------------------------------- owner history
  const person = writer.add(
    `IFCPERSON($,$,'DrawMyPlace',$,$,$,$,$)`,
  );
  const organization = writer.add(
    `IFCORGANIZATION($,'DrawMyPlace',$,$,$)`,
  );
  const personAndOrganization = writer.add(
    `IFCPERSONANDORGANIZATION(${person},${organization},$)`,
  );
  const application = writer.add(
    `IFCAPPLICATION(${organization},'1.0','DrawMyPlace','DMP')`,
  );
  const ownerHistory = writer.add(
    `IFCOWNERHISTORY(${personAndOrganization},${application},$,.ADDED.,$,$,$,${now})`,
  );

  // ------------------------------------------------------------------ units
  const metre = writer.add(`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const squareMetre = writer.add(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  const cubicMetre = writer.add(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
  const radian = writer.add(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const units = writer.add(
    `IFCUNITASSIGNMENT((${metre},${squareMetre},${cubicMetre},${radian}))`,
  );

  // --------------------------------------------------------------- contexts
  const worldPlacement = axis3(0, 0, 0, 1, 0);
  const context = writer.add(
    `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${worldPlacement},$)`,
  );
  const bodyContext = writer.add(
    `IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${context},$,.MODEL_VIEW.,$)`,
  );

  const project = writer.add(
    `IFCPROJECT(${guid(`project:${input.projectName}`)},${ownerHistory},${ifcString(
      input.projectName,
    )},$,$,${ifcString(input.planName ?? '')},$,(${context}),${units})`,
  );

  // ------------------------------------------------------- spatial structure
  const sitePlacement = localPlacement(null, 0, 0, 0);
  const site = writer.add(
    `IFCSITE(${guid(`site:${input.projectName}`)},${ownerHistory},'Site',$,$,${sitePlacement},$, $, .ELEMENT., $,$,$,$,$)`,
  );
  const buildingPlacement = localPlacement(null, 0, 0, 0);
  const building = writer.add(
    `IFCBUILDING(${guid(`building:${input.projectName}`)},${ownerHistory},${ifcString(
      input.projectName,
    )},$,$,${buildingPlacement},$,$,.ELEMENT.,$,$,$)`,
  );
  const storeyPlacement = localPlacement(null, 0, 0, 0);
  const storey = writer.add(
    `IFCBUILDINGSTOREY(${guid(`storey:${input.planName ?? input.projectName}`)},${ownerHistory},${ifcString(
      input.planName ?? 'Level 1',
    )},$,$,${storeyPlacement},$,$,.ELEMENT.,0.)`,
  );
  writer.add(
    `IFCRELAGGREGATES(${guid(`aggregate:project:${input.projectName}`)},${ownerHistory},$,$,${project},(${site}))`,
  );
  writer.add(
    `IFCRELAGGREGATES(${guid(`aggregate:site:${input.projectName}`)},${ownerHistory},$,$,${site},(${building}))`,
  );
  writer.add(
    `IFCRELAGGREGATES(${guid(`aggregate:building:${input.projectName}`)},${ownerHistory},$,$,${building},(${storey}))`,
  );

  // --------------------------------------------------------------- helpers
  const extrudedArea = (profile: string, depth: number) =>
    writer.add(
      `IFCEXTRUDEDAREASOLID(${profile},$,${zDirection},${number(depth)})`,
    );
  const bodyShape = (items: readonly string[]) => {
    const representation = writer.add(
      `IFCSHAPEREPRESENTATION(${bodyContext},'Body','SweptSolid',(${items.join(',')}))`,
    );

    return writer.add(
      `IFCPRODUCTDEFINITIONSHAPE($,$,(${representation}))`,
    );
  };
  const cableShape = (points: readonly string[], radius = 0.008) => {
    const polyline = writer.add(`IFCPOLYLINE((${points.join(',')}))`);
    const swept = writer.add(
      `IFCSWEPTDISKSOLID(${polyline},${number(radius)},$,$,$)`,
    );
    const representation = writer.add(
      `IFCSHAPEREPRESENTATION(${bodyContext},'Body','SweptSolid',(${swept}))`,
    );

    return writer.add(
      `IFCPRODUCTDEFINITIONSHAPE($,$,(${representation}))`,
    );
  };
  const rectangleProfile = (width: number, thickness: number) => {
    const position = axis2(width / 2, 0);
    return writer.add(
      `IFCRECTANGLEPROFILEDEF(.AREA.,$,${position},${number(width)},${number(thickness)})`,
    );
  };
  const circleProfile = (radius: number) =>
    writer.add(
      `IFCCIRCLEPROFILEDEF(.AREA.,$,${axis2(0, 0)},${number(radius)})`,
    );
  const addProperties = (
    element: string,
    name: string,
    properties: readonly Property[],
    seed: string,
  ) => {
    if (properties.length === 0) return;

    const values = properties.map((property) => {
      const value =
        typeof property.value === 'number'
          ? `IFCREAL(${number(property.value)})`
          : `IFCLABEL(${ifcString(property.value)})`;

      return writer.add(
        `IFCPROPERTYSINGLEVALUE(${ifcString(property.name)},$,${value},$)`,
      );
    });
    const set = writer.add(
      `IFCPROPERTYSET(${guid(`pset:${seed}`)},${ownerHistory},${ifcString(name)},$,(${values.join(',')}))`,
    );
    writer.add(
      `IFCRELDEFINESBYPROPERTIES(${guid(`psetrel:${seed}`)},${ownerHistory},$,$,(${element}),${set})`,
    );
  };

  const contained: string[] = [];

  // ----------------------------------------------------------------- walls
  let wallCount = 0;
  let openingCount = 0;

  for (const wall of drawing.walls) {
    const segments = wallSegments(wall);
    const thickness = wall.thickness
      ? wall.thickness * scale
      : defaultThickness;
    const wallOpenings = drawing.openings.filter(
      (opening) => opening.wallId === wall.id,
    );

    segments.forEach((segment, segmentIndex) => {
      wallCount += 1;
      const dir = normalizeDirection(
        segment.b.x - segment.a.x,
        -(segment.b.y - segment.a.y),
      );
      const lengthM = segment.length * scale;
      const placement = localPlacement(
        storeyPlacement,
        x(segment.a.x),
        y(segment.a.y),
        0,
        dir.x,
        dir.y,
      );
      const profile = rectangleProfile(lengthM, thickness);
      const solid = extrudedArea(profile, wallHeight);
      const shape = bodyShape([solid]);
      const name =
        wall.label ??
        `Wall ${drawing.walls.indexOf(wall) + 1}${
          segments.length > 1 ? `:${segmentIndex + 1}` : ''
        }`;
      const element = writer.add(
        `IFCWALL(${guid(`wall:${wall.id}:${segmentIndex}`)},${ownerHistory},${ifcString(
          name,
        )},$,$,${placement},${shape},$,$)`,
      );

      contained.push(element);
      addProperties(
        element,
        'Pset_DrawMyPlace_Wall',
        [
          { name: 'Thickness', value: thickness },
          { name: 'Height', value: wallHeight },
        ],
        `wall:${wall.id}:${segmentIndex}`,
      );

      for (const opening of wallOpenings) {
        const openingStart = opening.offset;
        const openingEnd = opening.offset + opening.width;

        if (
          openingEnd <= segment.startDistance ||
          openingStart >= segment.startDistance + segment.length
        ) {
          continue;
        }

        const start = Math.max(openingStart, segment.startDistance);
        const end = Math.min(
          openingEnd,
          segment.startDistance + segment.length,
        );
        if (end - start <= 1e-9) continue;

        openingCount += 1;
        const localStart = (start - segment.startDistance) * scale;
        const width = (end - start) * scale;
        const sill = opening.sillHeight * scale;
        const height = Math.min(
          opening.height * scale,
          Math.max(0.05, wallHeight - sill),
        );
        const openingPlacement = localPlacement(
          placement,
          localStart,
          0,
          sill,
        );
        const openingProfile = rectangleProfile(width, thickness + 0.02);
        const openingSolid = extrudedArea(openingProfile, height);
        const openingShape = bodyShape([openingSolid]);
        const openingElement = writer.add(
          `IFCOPENINGELEMENT(${guid(`opening:${opening.id}`)},${ownerHistory},${ifcString(
            opening.label ?? `Opening ${openingCount}`,
          )},$,$,${openingPlacement},${openingShape},$,$)`,
        );

        writer.add(
          `IFCRELVOIDSELEMENT(${guid(`void:${opening.id}`)},${ownerHistory},$,$,${element},${openingElement})`,
        );
        addProperties(
          openingElement,
          'Pset_DrawMyPlace_Opening',
          [
            { name: 'Type', value: opening.type },
            { name: 'Width', value: width },
            { name: 'Height', value: height },
            { name: 'SillHeight', value: sill },
          ],
          `opening:${opening.id}`,
        );
      }
    });
  }

  // ----------------------------------------------------------------- rooms
  let roomCount = 0;

  for (const room of drawing.rooms) {
    if (room.boundary.length < 3) continue;

    roomCount += 1;
    const points = room.boundary.map((point) => cartesian(x(point.x), y(point.y)));
    const first = room.boundary[0]!;
    points.push(cartesian(x(first.x), y(first.y)));
    const outerCurve = writer.add(`IFCPOLYLINE((${points.join(',')}))`);
    const profile = writer.add(
      `IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,${ifcString(room.name)},${outerCurve})`,
    );
    const solid = extrudedArea(profile, wallHeight);
    const shape = bodyShape([solid]);
    const placement = localPlacement(storeyPlacement, 0, 0, 0);
    const space = writer.add(
      `IFCSPACE(${guid(`space:${room.id}`)},${ownerHistory},${ifcString(
        room.name,
      )},$,$,${placement},${shape},${ifcString(room.name)},.ELEMENT.,.INTERNAL.,0.)`,
    );

    contained.push(space);
  }

  // ---------------------------------------------------------------- points
  let pointCount = 0;

  for (const point of drawing.points) {
    pointCount += 1;
    const height = pointHeight(point);
    const placement = localPlacement(
      storeyPlacement,
      x(point.x),
      y(point.y),
      height,
    );
    const profile =
      point.type === 'panel'
        ? writer.add(
            `IFCRECTANGLEPROFILEDEF(.AREA.,$,${axis2(0, 0)},0.4,0.2)`,
          )
        : circleProfile(point.type === 'light' ? 0.15 : 0.05);
    const depth = point.type === 'panel' ? 0.12 : 0.03;
    const solid = extrudedArea(profile, depth);
    const shape = bodyShape([solid]);
    const circuitId = point.properties.circuitId ?? null;
    const circuit = circuitId ? circuitNames.get(circuitId) : null;
    const subtype = point.properties.subtype ?? null;
    const name =
      point.label ??
      subtype ??
      `${point.type.charAt(0).toUpperCase()}${point.type.slice(1)} ${pointCount}`;
    const tag = subtype ?? point.type;
    const element = writer.add(
      `${pointEntityType(point)}(${guid(`point:${point.id}`)},${ownerHistory},${ifcString(
        name,
      )},$,$,${placement},${shape},${ifcString(tag)},$)`,
    );

    contained.push(element);
    addProperties(
      element,
      'Pset_DrawMyPlace_Device',
      [
        { name: 'PointType', value: point.type },
        ...(subtype ? [{ name: 'Subtype', value: subtype }] : []),
        ...(circuit ? [{ name: 'Circuit', value: circuit }] : []),
        { name: 'MountingHeight', value: height },
      ],
      `point:${point.id}`,
    );
  }

  // ---------------------------------------------------------------- routes
  let routeCount = 0;

  for (const route of drawing.routes) {
    if (route.geometry.length < 2) continue;

    routeCount += 1;
    const height = mountingHeight(route, wallHeight);
    const polylinePoints = route.geometry.map((point) =>
      cartesian(x(point.x), y(point.y), height),
    );
    const shape = cableShape(polylinePoints);
    const placement = localPlacement(storeyPlacement, 0, 0, 0);
    const circuitId = route.circuitId;
    const circuit = circuitId ? circuitNames.get(circuitId) : null;
    const name = circuit
      ? `${circuit} · route ${routeCount}`
      : `Cable route ${routeCount}`;
    const lengthM =
      route.geometry.reduce((sum, point, index) => {
        const previous = route.geometry[index - 1];
        if (!previous) return sum;

        return sum + Math.hypot(point.x - previous.x, point.y - previous.y) * scale;
      }, 0);
    const element = writer.add(
      `IFCCABLESEGMENT(${guid(`route:${route.id}`)},${ownerHistory},${ifcString(
        name,
      )},$,$,${placement},${shape},$,.CABLESEGMENT.)`,
    );

    contained.push(element);
    addProperties(
      element,
      'Pset_DrawMyPlace_Cable',
      [
        ...(circuit ? [{ name: 'Circuit', value: circuit }] : []),
        {
          name: 'Mounting',
          value: route.settings.mounting ?? 'unspecified',
        },
        { name: 'PlanLength', value: lengthM },
      ],
      `route:${route.id}`,
    );
  }

  if (contained.length > 0) {
    writer.add(
      `IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid(`containment:${input.planName ?? input.projectName}`)},${ownerHistory},$,$,(${contained.join(',')}),${storey})`,
    );
  }

  const fileName = `${safeFileName(
    `${input.projectName}-${input.planName ?? 'plan'}`,
  )}.ifc`;

  return {
    text: writer.render(fileName, timestamp),
    fileName,
    scale,
    calibrated,
    stats: {
      walls: wallCount,
      openings: openingCount,
      points: pointCount,
      routes: routeCount,
      rooms: roomCount,
      entities: writer.count,
    },
  };
}
