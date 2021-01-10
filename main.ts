import * as fs from 'fs';
import path from 'path';
import { default as axios } from 'axios';
import moment from 'moment';
import xpath from 'xpath';
import dom from 'xmldom';

const months = [
  'januar', 'februar', 'marcius', 'aprilis', 'majus', 'junius',
  'julius', 'augusztus', 'szeptember', 'oktober', 'november', 'december',
];


export interface BibleVerse {
  keres: {
    feladat: string;
    hivatkozas: string;
    forma: string;
  };
  valasz: {
    versek: Versek[];
    forditas: {
      nev: string;
      rov: string;
    };
  };
}

export interface Versek {
  szoveg: string;
  jegyzetek: {
    position: null;
    text:     string;
  }[];
  hely: {
    gepi: number;
    szep: string;
  };
};


async function getBibleVerse(ref: string): Promise<string> {
  const reference = ref.replace(':', ',');
  try {
    const { data } = await axios.get<BibleVerse>(
      encodeURI(`https://szentiras.hu/api/idezet/${reference}/RUF`)
    );
    return data ? `"${data.valasz.versek.map(v => v.szoveg).join(' ')}" ${ref}` : '';
  } catch (err) {
    console.log(reference);
    console.error(err);
    return '';
  }
}

async function getDate(date: string, format: string = "YYYY-MM-DD") {
  try {
    const d = moment(date, format);

    if (d.day() !== 0) {
      throw "Not a Sunday!";
    }

    const { data: html } = await axios.get<string>(
      `https://www.rmbgysz.ro/${d.year()}-${months[d.month()]}-${d.date()}-vasarnap`
    );

    const doc = new dom.DOMParser({
      errorHandler: {
        warning: () => {},
        error: () => {},
        fatalError: err => console.error(err),
      }
    }).parseFromString(html, '');

    const res = xpath.select(
      '//div[contains(@class, "field-name-field-ahitat-bibliaora")]' +
      '//div[contains(@class, "field-items")]' +
      '/div[contains(@class, "field-item even")]/p',
      doc,
    );

    const parentheses = (res[0] as Element).childNodes[0].nodeValue!
      .split('(')
      .map(v => v.replace(')', ''))
      .filter((v, i) => i > 0 && !v.startsWith('Károli f.'));

    return parentheses[parentheses.length - 1].trim();

  } catch (err) {
    // console.error(err);
    return '';
  }
}

async function main() {
  let d = moment().add(7, 'days');
  let res: string[] = [];
  while (d.month() < 5) {
    if (d.day() !== 0) {
      d = d.add(1, 'day');
    } else {
      const ref = await getDate(d.format("YYYY-MM-DD"));
      const temp = await getBibleVerse(ref);
      res = [...res, `${d.format('YYYY-MM-DD')}\n${temp}`];
      d = d.add(7, 'days');
    }
  }

  if (res.length > 0) {
    fs.writeFileSync(
      path.join(process.cwd(), 'result.txt'),
      res.filter(v => v.length > 0).join('\n\n'),
    );
  }
}

main();
