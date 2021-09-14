const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const {
  layers,
  width,
  height,
  description,
  baseImageUri,
  editionSize,
  startEditionFrom,
  rarityWeights,
  includeSign,
  SFBP,
} = require("config.js");
const console = require("console");
const { NONAME } = require("dns");
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

// saves the generated image to the output folder, using the edition count as the name
const saveImage = (_editionCount) => {
  fs.writeFileSync(
    `./output/${_editionCount}.png`,
    canvas.toBuffer("image/png")
  );
};

// adds a signature to the top left corner of the canvas
const signImage = (_sig) => {
  ctx.fillStyle = "#000000";
  ctx.font = "bold 30pt Courier";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(_sig, 40, 40);
};

// generate a random color hue
const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, 85%)`;
  return pastel;
};

const drawBackground = () => {
  ctx.fillStyle = genColor();
  ctx.fillRect(0, 0, width, height);
};

// add metadata for individual nft edition
/*
const generateMetadata = (_dna, _edition, _attributesList) => {
  let dateTime = Date.now();
  let tempMetadata = {
    dna: _dna.join(""),
    name: `#${_edition}`,
    description: description,
    image: `${baseImageUri}/${_edition}`,
    edition: _edition,
    date: dateTime,
    attributes: _attributesList,
  };
  return tempMetadata;
};
*/

const generateMetadata = (_dna, _edition, _attributesList, _SFBP) => {
  let dateTime = Date.now();
  let tempMetadata = {
    //dna: _dna.join(""),
    name: `#${_edition}`,
    symbol: "",
    description: description,
    image: `${baseImageUri}/${_edition}`,
    seller_fee_basis_points: _SFBP,
    properties: {
      creators: [{
        address: "5GN3sGvtcRFEo99wbweUKBQSHX4fFFQaETiov4P8Z2uX",
        share: 100}],
      files: [{
        uri: `${_edition}.png`,
        type: 'image/png'}],
      },
    attributes: _attributesList,
  };
  return tempMetadata;
};


// prepare attributes for the given element to be used as metadata
const getAttributeForElement = (_element) => {
  let selectedElement = _element.layer.selectedElement;
  //console.log(selectedElement)
  let attribute = {
    trait_type: _element.layer.property,
    value: selectedElement.name,

    /*
    [_element.layer.property] : selectedElement.name,
    name: selectedElement.name,
    rarity: selectedElement.rarity,
    */
  };
  return attribute;
};

// loads an image from the layer path
// returns the image in a format usable by canvas
const loadLayerImg = async (_layer) => {
  return new Promise(async (resolve) => {
    const image = await loadImage(`${_layer.selectedElement.path}`);
    resolve({ layer: _layer, loadedImage: image });
  });
};

const drawElement = (_element) => {
  ctx.drawImage(
    _element.loadedImage,
    _element.layer.position.x,
    _element.layer.position.y,
    _element.layer.size.width,
    _element.layer.size.height
  );
};

// check the configured layer to find information required for rendering the layer
// this maps the layer information to the generated dna and prepares it for
// drawing on a canvas
const constructLayerToDna = (_dna = [], _layers = [], _rarity) => {
  let mappedDnaToLayers = _layers.map((layer, index) => {
    let selectedElement = layer.elements.find(element => element.id === _dna[index]);
    return {
      property: layer.id,
      location: layer.location,
      position: layer.position,
      size: layer.size,
      selectedElement: {...selectedElement, rarity: _rarity },
    };
  });
  return mappedDnaToLayers;
};

// check if the given dna is contained within the given dnaList 
// return true if it is, indicating that this dna is already in use and should be recalculated
const isDnaUnique = (_DnaList = [], _dna = []) => {
  let foundDna = _DnaList.find((i) => i.join("") === _dna.join(""));
  return foundDna == undefined ? true : false;
};

const getRandomRarity = (_rarityOptions) => {
  let randomPercent = Math.random() * 100;
  let percentCount = 0;

  for (let i = 0; i <= _rarityOptions.length; i++) {
    percentCount += _rarityOptions[i].percent;
    if (percentCount >= randomPercent) {
      console.log(`use random rarity ${_rarityOptions[i].id}`)
      return _rarityOptions[i].id;
    }
  }
  return _rarityOptions[0].id;
}

// create a dna based on the available layers for the given rarity
// use a random part for each layer
const createDna = (_layers, _rarity) => {
  let randNum = [];
  let _rarityWeight = rarityWeights.find(rw => rw.value === _rarity);
  _layers.forEach((layer) => {
    let num = Math.floor(Math.random() * layer.elementIdsForRarity[_rarity].length);
    if (_rarityWeight && _rarityWeight.layerPercent[layer.id]) {
      // if there is a layerPercent defined, we want to identify which dna to actually use here (instead of only picking from the same rarity)
      let _rarityForLayer = getRandomRarity(_rarityWeight.layerPercent[layer.id]);
      num = Math.floor(Math.random() * layer.elementIdsForRarity[_rarityForLayer].length);
      randNum.push(layer.elementIdsForRarity[_rarityForLayer][num]);
    } else {
      randNum.push(layer.elementIdsForRarity[_rarity][num]);
    }
  });
  return randNum;
};

// holds which rarity should be used for which image in edition
let rarityForEdition;
// get the rarity for the image by edition number that should be generated
const getRarity = (_editionCount) => {
  if (!rarityForEdition) {
    // prepare array to iterate over
    rarityForEdition = [];
    rarityWeights.forEach((rarityWeight) => {
      for (let i = rarityWeight.from; i <= rarityWeight.to; i++) {
        rarityForEdition.push(rarityWeight.value);
      }
    });
  }
  return rarityForEdition[editionSize - _editionCount];
};

// write each nft meta data but also write a master _metadata
const writeMetaData = (_data, editionCountInfo) => {
  if (editionCountInfo === null) {
    fs.writeFileSync("./output/_metadata.json", _data);
  } else if (editionCountInfo != null) {
    fs.writeFileSync(`./output/${editionCountInfo}.json`, _data);
  }
};

// holds which dna has already been used during generation
let dnaListByRarity = {};
// holds metadata for all NFTs
let metadataList = [];
// Create generative art by using the canvas api
const startCreating = async () => {
  console.log('##################');
  console.log('# Generative Art');
  console.log('# - Create your NFT collection');
  console.log('##################');

  console.log();
  console.log('start creating NFTs.')

  // clear meta data from previous run
  writeMetaData("");

  // prepare dnaList object
  rarityWeights.forEach((rarityWeight) => {
    dnaListByRarity[rarityWeight.value] = [];
  });

  // create NFTs from startEditionFrom to editionSize
  let editionCount = startEditionFrom;
  while (editionCount <= editionSize) {
    console.log('-----------------')
    console.log('creating NFT %d of %d', editionCount, editionSize);

    // get rarity from to config to create NFT as
    let rarity = getRarity(editionCount);
    console.log('- rarity: ' + rarity);

    // calculate the NFT dna by getting a random part for each layer/feature 
    // based on the ones available for the given rarity to use during generation
    let newDna = createDna(layers, rarity);
    while (!isDnaUnique(dnaListByRarity[rarity], newDna)) {
      // recalculate dna as this has been used before.
      console.log('found duplicate DNA ' + newDna.join('-') + ', recalculate...');
      newDna = createDna(layers, rarity);
    }
    console.log('- dna: ' + newDna.join('-'));

    // propagate information about required layer contained within config into a mapping object
    // = prepare for drawing
    let results = constructLayerToDna(newDna, layers, rarity);
    //console.log(results[1])
    let loadedElements = [];

    // load all images to be used by canvas
    results.forEach((layer) => {
      loadedElements.push(loadLayerImg(layer));
    });

    // elements are loaded asynchronously
    // -> await for all to be available before drawing the image
    await Promise.all(loadedElements).then((elementArray) => {
      // create empty image
      ctx.clearRect(0, 0, width, height);
      // draw a random background color
      drawBackground();
      // store information about each layer to add it as meta information
      let attributesList = [];
      // draw each layer
      elementArray.forEach((element) => {
        drawElement(element);
        attributesList.push(getAttributeForElement(element));
        console.log(element.layer.property)
      });
      // add an image signature as the edition count to the top left of the image
      if (includeSign == true) {
        signImage(`#${editionCount}`);
      }
      // write the image to the output directory
      saveImage(editionCount);
      // append metadata
      console.log(`sellerBP = ${SFBP}`)
      let nftMetadata = generateMetadata(newDna, editionCount, attributesList, SFBP);
      metadataList.push(nftMetadata)
      // write metadata for inidivudal file
      //fs.writeFileSync(`./output/${editionCount}.json`, JSON.stringify(nftMetadata));
      writeMetaData(JSON.stringify(nftMetadata), editionCount)
      // logging
      console.log('- metadata: ' + JSON.stringify(nftMetadata));
      console.log('- edition ' + editionCount + ' created.');
      console.log();
    });
    dnaListByRarity[rarity].push(newDna);
    editionCount++;
  }
  // writeMetaData(JSON.stringify(metadataList), null);
};

// Initiate code
startCreating();