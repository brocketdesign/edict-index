const FlexSearch = require('flexsearch');
const assert = require('assert');
const IndexWrapper = require('./index_wrapper.js');

function parseGloss(gloss) {
  // Just ignore the EntL stuff... until someone needs it I guess.
  if (gloss.startsWith('EntL')) {
    return undefined;
  }

  const glossInfo = {
    tags: [],
    seeAlso: [],
    definition: '',
  };

  let trimmedRemainingGloss = gloss.replace(/\{\}/g, '').trim();
  assert(trimmedRemainingGloss);

  while (trimmedRemainingGloss.indexOf('(') === 0) {
    const chunkEndIndex = trimmedRemainingGloss.indexOf(')');
    assert(chunkEndIndex !== -1);

    const chunk = trimmedRemainingGloss.substring(1, chunkEndIndex).trim();

    if (chunk.startsWith('See')) {
      glossInfo.seeAlso.push(chunk.replace('See', '').trim());
    } else {
      const tags = chunk.split(',');
      glossInfo.tags.push(...tags);
    }

    trimmedRemainingGloss = trimmedRemainingGloss.substring(chunkEndIndex + 1).trim();
  }

  if (!trimmedRemainingGloss) {
    return undefined;
  }

  glossInfo.definition = trimmedRemainingGloss;

  return glossInfo;
}

function splitGlossPart(glossPart) {
  const glosses = [];
  let currentGloss = [];
  let inParens = false;

  for (let i = 0; i < glossPart.length; i += 1) {
    if (glossPart[i] === '/' && !inParens) {
      const currentGlossString = currentGloss.join('').trim();
      if (currentGlossString) {
        glosses.push(currentGlossString);
        currentGloss = [];
      }
    } else {
      if (glossPart[i] === '(') {
        inParens = true;
      } else if (glossPart[i] === ')') {
        inParens = false;
      }

      currentGloss.push(glossPart[i]);
    }
  }

  return glosses;
}

function createDocumentForEdictLine(line, index) {
  const glossStartIndex = line.indexOf('/');
  const preGlossPart = line.substring(0, glossStartIndex);
  const glossPart = line.substring(glossStartIndex);

  let readingsPart = '';
  const kanjiPart = preGlossPart.replace(/\[(.*?)\]/, (fullMatch, readingsGroup) => {
    readingsPart = readingsGroup;
    return '';
  }).trim();

  const kanji = kanjiPart.split(';');
  const readings = readingsPart.split(';').filter(x => x);
  const glosses = splitGlossPart(glossPart).map(parseGloss).filter(x => x);

  return {
    index,
    kanjiIndex: kanji.join(','),
    readingsIndex: readings.join(','),
    kanji,
    readings,
    glosses,
  };
}

/**
 * Build the index.
 * @param {String} edictUtf8String A stringified EDICT dictionary.
 */
function buildIndex(edictUtf8String) {
  const lines = edictUtf8String.split('\n').slice(1); // First line is metadata

  const flexSearchIndex = new FlexSearch({
    encode: false,
    tokenize(str) {
      return str.replace(/[\x32-\x7F]/g, '').split('');
    },
    doc: {
      id: 'index',
      field: [
        'kanjiIndex',
        'readingsIndex',
      ],
    },
  });

  lines.forEach((line, i) => {
    flexSearchIndex.add(createDocumentForEdictLine(line, i));
  });

  const indexWrapper = new IndexWrapper(flexSearchIndex);
  return indexWrapper;
}

module.exports = buildIndex;