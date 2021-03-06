/* eslint-disable @typescript-eslint/ban-ts-comment */
import React from 'react';
import { remote } from 'electron';
import { promises } from 'fs';
// import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import jsonata from 'jsonata';
import styles from './Home.css';

const xslx = require('json-as-xlsx');

export default function Home() {
  async function getFile() {
    const filename = await remote.dialog.showOpenDialog({
      properties: ['openFile'],
    });
    return promises.readFile(filename.filePaths[0]).then((value) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return JSON.parse(value);
    });
  }

  // @ts-ignore
  const queryResult = (result) => {
    // noinspection SpellCheckingInspection
    const columns = [
      { label: 'Symbol Code', value: () => 'SFGPU------****' },
      // @ts-ignore
      { label: 'Name', value: (row) => row.Name },
      { label: 'Comment', value: () => 'This is a fine comment.' },
      // @ts-ignore
      { label: 'Latitude', value: (row) => row.Latitude },
      // @ts-ignore
      { label: 'Longitude', value: (row) => row.Longitude },
      // @ts-ignore
      { label: 'Key', value: (row) => sha1(row.Name) },
    ];
    const settings = {
      sheetName: 'First Sheet',
      fileName: 'COP View',
      extraLength: 3,
    };
    const download = true;
    xslx(columns, result, settings, download);
  };

  async function queryFileForJSON() {
    const rawData = await getFile();
    const jsonData = JSON.stringify(rawData);
    // eslint-disable-next-line no-console
    console.log(`We finish with ${jsonData}`);
    // noinspection SpellCheckingInspection
    const expression = jsonata(
      '`Game Map`.*.{"Symbol Code": "SFGPU------****", "Name": BasicName, "Comment": "This is a comment.", "Latitude": function($pixels) { 57.64451092 - $pixels * 0.000245657 }(CurrentX), "Longitude": function($pixels) { 22.9375029 + $pixels * 0.000388979 }(CurrentX)}'
    );
    const result = expression.evaluate(rawData);
    queryResult(result);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
    return result;
  }

  function getOnClick() {
    async function getClick() {
      await queryFileForJSON();
    }
    return getClick;
  }

  return (
    <div className={styles.container} data-tid="container">
      <button
        className="f3 link dim br2 ph3 pv2 mb2 dib white bg-dark-red"
        onClick={getOnClick()}
        data-tclass="btn"
        type="button"
      >
        <i className="far fa-play-circle" />
        &nbsp;Easy Button
      </button>
    </div>
  );
}
