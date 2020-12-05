import { remote } from 'electron';
import { promises } from 'fs';
import jsonata from 'jsonata';
import sha1 from 'sha1';
import { v4 as uuidv4, parse as uuidParse } from 'uuid';

const xslx = require('json-as-xlsx');
const { create } = require('xmlbuilder2');
const dF = require('../date.format');

function getMostSignificantBits(id) {
  // First 64 bits => BigInt
  console.log(uuidv4);
  console.log(uuidParse); // returns undefined
  return uuidParse(id)
    .slice(0, 8)
    .reduce((a, b) => (a << 8n) | BigInt(b), 0n);
}

function getLeastSignificantBits(id) {
  // Last 64 bits => BigInt
  return uuidParse(id)
    .slice(8, 16)
    .reduce((a, b) => (a << 8n) | BigInt(b), 0n);
}

// eslint-disable-next-line import/prefer-default-export
export async function readJSONFile() {
  const filename = await remote.dialog.showOpenDialog({
    properties: ['openFile'],
  });
  return promises.readFile(filename.filePaths[0]).then((value) => {
    return JSON.parse(value.toString());
  });
}

export async function exportAsCSV(gameAsJSON: any) {
  const expression = jsonata(
    '`Game Map`.*.{"Symbol Code": "SFGPU------****",' +
      ' "Name": BasicName, "Comment": "This is a comment.",' +
      ' "Latitude": function($pixels) { 57.64451092 - $pixels * 0.000245657 }(CurrentX),' +
      ' "Longitude": function($pixels) { 22.9375029 + $pixels * 0.000388979 }(CurrentX)}'
  );
  const result = expression.evaluate(gameAsJSON);
  // noinspection SpellCheckingInspection
  const columns = [
    { label: 'Symbol Code', value: () => 'SFGPU------****' },
    { label: 'Name', value: (row: any) => row.Name },
    { label: 'Comment', value: () => 'This is a fine comment.' },
    { label: 'Latitude', value: (row: any) => row.Latitude },
    { label: 'Longitude', value: (row: any) => row.Longitude },
    { label: 'Key', value: (row: any) => sha1(row.Name) },
  ];
  const settings = {
    sheetName: 'First Sheet',
    fileName: 'COP View',
    extraLength: 3,
  };
  const download = true;
  xslx(columns, result, settings, download);
}

export async function exportAsSLF(gameAsJSON: string) {
  const root = create({ version: '1.0', encoding: 'utf-8' }).ele(
    'LayerFileFormatRoot'
  );
  // Create the first half of the document, up to the units/symbols
  root
    .att('xmlns:xsd', 'http://www.w3.org/2001/XMLSchema')
    .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    .att(
      'xmlns',
      'http://schemas.systematic.com/2011/products/layer-definition-v4'
    )
    .ele('Layers')
    .ele('Layer')
    .att('xsi:type', 'SituationLayer')
    .ele('Name')
    .txt('foo')
    .up()
    .ele('SecurityClassification')
    .txt('Unmarked')
    .up()
    .ele('Symbols');

  // Add each of the units/symbols
  const expression = jsonata(
    `\`Game Map\`.*.{
"Location": {"Latitude": function($pixels) { 57.64451092 - $pixels * 0.000245657 }(CurrentX) ,
"Longitude": function($pixels) { 22.9375029 + $pixels * 0.000388979 }(CurrentY)},
"Priority": "Medium",
"Name": BasicName,
"Report": {"Comment": "" , "Reported": ""},
"SymbolCode": {"SymbolCodeString": "SFGPU------****"},
"StaffComments": "50%",
"UUID": UUID,
"AbbreviatedName": "",
"OperationalStatus": "Operational"
}`
  );
  const unitArray = expression.evaluate(gameAsJSON);
  unitArray.forEach((unit: any) => {
    const msb = getMostSignificantBits(unit.UUID);
    const lsb = getLeastSignificantBits(unit.UUID);
    root
      .last()
      .last()
      .last()
      .ele('Symbol')
      .att('xsi:type', 'Unit')
      .ele('Location')
      .att('xsi:type', 'Point')
      .ele('Latitude')
      .txt(unit.Location.Latitude)
      .up()
      .ele('Longitude')
      .txt(unit.Location.Longitude)
      .up()
      .up()
      .ele('Priority')
      .txt(unit.Priority)
      .up()
      .ele('Name')
      .txt(unit.Name)
      .up()
      .ele('Report')
      .ele('Comment')
      .txt(unit.Comment)
      .up()
      .ele('Reported')
      .txt(dF.dateFormat('isoUtcDateTime'))
      .up()
      .up()
      .ele('SymbolCode')
      .ele('SymbolCodeString')
      .txt(unit.SymbolCode.SymbolCodeString)
      .up()
      .up()
      .ele('StaffComments')
      .txt(unit.StaffComments)
      .up()
      .ele('Id')
      .ele('FirstLong')
      .txt(msb)
      .up()
      .ele('SecondLong')
      .txt(lsb)
      .up()
      .up()
      .ele('AbbreviatedName')
      .txt(unit.AbbreviatedName)
      .up()
      .ele('OperationalStatus')
      .txt(unit.OperationalStatus);
  });

  const splID = uuidv4();
  const msb = getMostSignificantBits(splID);
  const lsb = getLeastSignificantBits(splID);

  // Add the remaining elements of the document
  root
    .last()
    .last()
    .ele('Id', {
      // eslint-disable-next-line
      'xmlns': 'http://schemas.systematic.com/2011/products/layer-definition-v4'
    })
    .ele('FirstLong')
    .txt(msb)
    .up()
    .ele('SecondLong')
    .txt(lsb)
    .up()
    .up()
    .ele('Extension', {
      // eslint-disable-next-line
      'xmlns': 'http://schemas.systematic.com/2011/products/layer-definition-v4'
    })
    .ele('ExtensionDescription')
    .txt(
      'This extension contains prefix and suffix for the security' +
        ' classification for the plan layer'
    )
    .up()
    .ele('SecurityClassificationPrefix')
    .up()
    .ele('SecurityClassificationPostfix')
    .up()
    .up()
    .ele('Category')
    .txt('GloballySignificant')
    .up()
    .ele('Path')
    .up()
    .up()
    .up()
    .ele('Version')
    .txt('4');
  const xml = root.end({ prettyPrint: true });
  await promises.writeFile('LandPower.slf', xml);
}

export async function exportAsSPL(gameAsJSON: string) {
  const root = create({ version: '1.0', encoding: 'utf-8' }).ele('PlanLayer');
  root
    .att('xmlns:xsd', 'http://www.w3.org/2001/XMLSchema')
    .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    .att(
      'xmlns',
      'http://schemas.systematic.com/2011/products/plan-layer-definition-v1'
    )
    .ele('CustomAttributes', {
      // eslint-disable-next-line prettier/prettier
      'xmlns': 'http://schemas.systematic.com/2011/products/layer-definition-v4'
    })
    .ele('CustomAttributeEntry')
    .ele('Key')
    .txt('customId')
    .up()
    .ele('Value')
    .txt(uuidv4())
    .up()
    .up()
    .up()
    .ele('Name', {
      // eslint-disable-next-line
      'xmlns':
        'http://schemas.systematic.com/2011/products/layer-definition-v4'
    })
    .txt('OPSUM 09OCT1500Z2025')
    .up()
    .ele(
      'SecurityClassification',
      // eslint-disable-next-line
      { 'xmlns': 'http://schemas.systematic.com/2011/products/layer-definition-v4' }
    )
    .txt('Unmarked')
    .up()
    .ele('Symbols', {
      // eslint-disable-next-line
      'xmlns': 'http://schemas.systematic.com/2011/products/layer-definition-v4'
    });

  // Add each of the units/symbols
  const expression = jsonata(
    `\`Game Map\`.*.{
"Location": {"Latitude": function($pixels) { 57.64451092 - $pixels * 0.000245657 }(CurrentX) ,
"Longitude": function($pixels) { 22.9375029 + $pixels * 0.000388979 }(CurrentY)},
"Priority": "Medium",
"Name": BasicName,
"Report": {"Comment": "" , "Reported": ""},
"SymbolCode": {"SymbolCodeString": "SFGPU------****"},
"StaffComments": "50%",
"UUID": UUID,
"AbbreviatedName": "",
"OperationalStatus": "Operational"
}`
  );
  const unitArray = expression.evaluate(gameAsJSON);
  unitArray.forEach((unit: any) => {
    const msb = getMostSignificantBits(unit.UUID);
    const lsb = getLeastSignificantBits(unit.UUID);
    root
      .last()
      .ele('Symbol')
      .att('xsi:type', 'Unit')
      .ele('Location')
      .att('xsi:type', 'Point')
      .ele('Latitude')
      .txt(unit.Location.Latitude)
      .up()
      .ele('Longitude')
      .txt(unit.Location.Longitude)
      .up()
      .up()
      .ele('Priority')
      .txt(unit.Priority)
      .up()
      .ele('Name')
      .txt(unit.Name)
      .up()
      .ele('Report')
      .ele('Comment')
      .txt(unit.Comment)
      .up()
      .ele('Reported')
      .txt(dF.dateFormat('isoUtcDateTime'))
      .up()
      .up()
      .ele('SymbolCode')
      .ele('SymbolCodeString')
      .txt(unit.SymbolCode.SymbolCodeString)
      .up()
      .up()
      .ele('StaffComments')
      .txt(unit.StaffComments)
      .up()
      .ele('Id')
      .ele('FirstLong')
      .txt(msb)
      .up()
      .ele('SecondLong')
      .txt(lsb)
      .up()
      .up()
      .ele('AbbreviatedName')
      .txt(unit.AbbreviatedName)
      .up()
      .ele('OperationalStatus')
      .txt(unit.OperationalStatus);
  });

  const splID = uuidv4();
  const msb = getMostSignificantBits(splID);
  const lsb = getLeastSignificantBits(splID);

  root
    .ele('Id', {
      // eslint-disable-next-line
      'xmlns': 'http://schemas.systematic.com/2011/products/layer-definition-v4'
    })
    .ele('FirstLong')
    .txt(msb)
    .up()
    .ele('SecondLong')
    .txt(lsb)
    .up()
    .up()
    .ele('Extension', {
      // eslint-disable-next-line
      'xmlns': 'http://schemas.systematic.com/2011/products/layer-definition-v4'
    })
    .ele('ExtensionDescription')
    .txt(
      'This extension contains prefix and suffix for the security' +
        ' classification for the plan layer'
    )
    .up()
    .ele('SecurityClassificationPrefix')
    .up()
    .ele('SecurityClassificationPostfix')
    .up()
    .up()
    .ele('DevelopmentState', {
      // eslint-disable-next-line
      'xmlns': 'http://schemas.systematic.com/2011/products/layer-definition-v4'
    })
    .txt('NotComplete');
  const xml = root.end({ prettyPrint: true });
  await promises.writeFile('LandPower.spl', xml);
}
