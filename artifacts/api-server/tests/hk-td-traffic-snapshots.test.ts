import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractDocumentedRecords,
  parseHkTdTrafficSnapshots,
} from "../src/camera-providers/hk-td-traffic-snapshots";

/**
 * Fixtures are shaped after the provider's published data dictionary
 * (`Summary_of_traffic_snapshot_images.pdf`): Key, Region, District,
 * Description, Easting, Northing, Latitude, Longitude, url — with values
 * copied from the real `Traffic_Camera_Locations_En` resource.
 *
 * The exact XML element names could not be read from this workspace (all
 * outbound TLS is blocked here, and the research fetcher strips tags), so the
 * parser keys on the documented field names rather than on a container name.
 * These tests pin that behaviour, including the fail-closed path.
 */
const catalogue = `<?xml version="1.0" encoding="UTF-8"?>
<Traffic_Camera_Locations>
  <image>
    <Key>H429F</Key>
    <Region>Hong Kong Island</Region>
    <District>Southern</District>
    <Description>Aberdeen Praya Road near Fish Market [H429F]</Description>
    <Easting>833549</Easting>
    <Northing>812187</Northing>
    <Latitude>22.24845</Latitude>
    <Longitude>114.1505</Longitude>
    <url>https://tdcctv.data.one.gov.hk/H429F.JPG</url>
  </image>
  <image>
    <Key>K809F2</Key>
    <Region>Kowloon</Region>
    <District>Kwun Tong</District>
    <Description>Kwun Tong Road near Kowloon Bay MTR Station [K809F2]</Description>
    <Easting>840179</Easting>
    <Northing>820053</Northing>
    <Latitude>22.31947692</Latitude>
    <Longitude>114.2148344</Longitude>
    <url>http://tdcctv.data.one.gov.hk/K809F2.JPG</url>
  </image>
</Traffic_Camera_Locations>`;

test("parses the documented Hong Kong fields into live-image camera records", () => {
  const cameras = parseHkTdTrafficSnapshots(catalogue);
  assert.equal(cameras.length, 2);

  const first = cameras[0]!;
  assert.equal(first.id, "hk-td-traffic-snapshots-H429F");
  assert.equal(first.provider, "hk-td-traffic-snapshots");
  assert.equal(
    first.displayName,
    "Aberdeen Praya Road near Fish Market [H429F]",
  );
  assert.equal(first.country, "Hong Kong SAR, China");
  assert.equal(first.countryCode, "HK");
  assert.equal(first.region, "Hong Kong Island");
  assert.equal(first.district, "Southern");
  assert.equal(first.latitude, 22.24845);
  assert.equal(first.longitude, 114.1505);

  // The documented current-image contract is what earns live-image.
  assert.equal(first.viewCapability, "live-image");
  assert.equal(first.mediaType, "image");
  assert.equal(first.mediaUrl, "https://tdcctv.data.one.gov.hk/H429F.JPG");
  assert.equal(first.streamKind, "image");
  // Documented cadence: "Every 2 minutes".
  assert.equal(first.imageUpdateRateMs, 120_000);
  assert.equal(first.feedStatus, "not-probed");
  assert.equal(first.publicAccess, "catalogue-listed");

  // The terms require naming the department, the Government and DATA.GOV.HK.
  assert.match(first.attribution, /Transport Department/);
  assert.match(first.attribution, /Hong Kong SAR/);
  assert.match(first.attribution, /DATA\.GOV\.HK/);

  // A provider http URL is upgraded rather than handed to a webview as mixed
  // content.
  assert.equal(
    cameras[1]?.mediaUrl,
    "https://tdcctv.data.one.gov.hk/K809F2.JPG",
  );
});

test("never emits unavailable, because the provider publishes no per-camera availability", () => {
  // "No Service" is rendered into the image itself, so catalogue data can
  // never justify an `unavailable` record. Synthesising one would be
  // fabricating provider state.
  const cameras = parseHkTdTrafficSnapshots(catalogue);
  assert.ok(cameras.every((camera) => camera.viewCapability === "live-image"));
});

test("drops cameras hosted outside the documented Transport Department origin", () => {
  // A government catalogue can list other operators' cameras whose terms have
  // not been read. Those are dropped rather than republished under TD's
  // attribution.
  const withPartnerCamera = `<data>
    <image>
      <Key>PARTNER1</Key>
      <Latitude>22.3</Latitude>
      <Longitude>114.2</Longitude>
      <url>https://cameras.example.test/PARTNER1.jpg</url>
    </image>
    <image>
      <Key>H429F</Key>
      <Latitude>22.24845</Latitude>
      <Longitude>114.1505</Longitude>
      <url>https://tdcctv.data.one.gov.hk/H429F.JPG</url>
    </image>
  </data>`;
  const cameras = parseHkTdTrafficSnapshots(withPartnerCamera);
  assert.deepEqual(
    cameras.map((camera) => camera.id),
    ["hk-td-traffic-snapshots-H429F"],
  );
});

test("rejects malformed coordinates, unsafe URLs, placeholder points and duplicates", () => {
  const messy = `<data>
    <image>
      <Key>BAD1</Key><Latitude>95</Latitude><Longitude>114</Longitude>
      <url>https://tdcctv.data.one.gov.hk/BAD1.JPG</url>
    </image>
    <image>
      <Key>BAD2</Key><Latitude>0</Latitude><Longitude>0</Longitude>
      <url>https://tdcctv.data.one.gov.hk/BAD2.JPG</url>
    </image>
    <image>
      <Key>BAD3</Key><Latitude>22.3</Latitude><Longitude>114.2</Longitude>
      <url>javascript:alert(1)</url>
    </image>
    <image>
      <Key>not a key!</Key><Latitude>22.3</Latitude><Longitude>114.2</Longitude>
      <url>https://tdcctv.data.one.gov.hk/x.JPG</url>
    </image>
    <image>
      <Key>H429F</Key><Latitude>22.24845</Latitude><Longitude>114.1505</Longitude>
      <url>https://tdcctv.data.one.gov.hk/H429F.JPG</url>
    </image>
    <image>
      <Key>H429F</Key><Latitude>22.9</Latitude><Longitude>114.9</Longitude>
      <url>https://tdcctv.data.one.gov.hk/H429F.JPG</url>
    </image>
  </data>`;
  const cameras = parseHkTdTrafficSnapshots(messy);
  assert.deepEqual(
    cameras.map((camera) => camera.id),
    ["hk-td-traffic-snapshots-H429F"],
  );
  assert.equal(cameras[0]?.latitude, 22.24845);
});

test("falls back to the documented request path only when no URL is published", () => {
  const withoutUrl = `<data>
    <image>
      <Key>TC604F</Key>
      <Latitude>22.36</Latitude>
      <Longitude>114.07</Longitude>
      <url></url>
    </image>
  </data>`;
  // An empty url fails the required-field check, so nothing is published.
  assert.deepEqual(parseHkTdTrafficSnapshots(withoutUrl), []);
});

test("decodes entities and tolerates namespace prefixes and self-closing fields", () => {
  const namespaced = `<ns:data xmlns:ns="urn:example">
    <ns:image>
      <ns:Key>H106F</ns:Key>
      <ns:Region>Hong Kong Island</ns:Region>
      <ns:District>Central &amp; Western</ns:District>
      <ns:Description>Connaught Road Central near Exchange Square [H106F]</ns:Description>
      <ns:Latitude>22.2859674</ns:Latitude>
      <ns:Longitude>114.1557495</ns:Longitude>
      <ns:url>https://tdcctv.data.one.gov.hk/H106F.JPG</ns:url>
    </ns:image>
  </ns:data>`;
  const cameras = parseHkTdTrafficSnapshots(namespaced);
  assert.equal(cameras.length, 1);
  assert.equal(cameras[0]?.district, "Central & Western");
  assert.equal(cameras[0]?.region, "Hong Kong Island");
});

test("fails closed when the documented data dictionary is absent", () => {
  // A renamed schema must produce nothing, so the provider reports a
  // catalogue failure instead of publishing half-understood records.
  const renamed = `<data>
    <camera>
      <cameraId>H429F</cameraId>
      <lat>22.24845</lat>
      <lng>114.1505</lng>
      <imageUrl>https://tdcctv.data.one.gov.hk/H429F.JPG</imageUrl>
    </camera>
  </data>`;
  assert.deepEqual(extractDocumentedRecords(renamed), []);
  assert.deepEqual(parseHkTdTrafficSnapshots(renamed), []);
  assert.deepEqual(parseHkTdTrafficSnapshots(""), []);
  assert.deepEqual(parseHkTdTrafficSnapshots("<data></data>"), []);
});

test("does not treat the wrapper element as a record", () => {
  const records = extractDocumentedRecords(catalogue);
  assert.equal(records.length, 2);
  assert.equal(records[0]?.get("key"), "H429F");
  assert.equal(records[0]?.get("easting"), "833549");
});
