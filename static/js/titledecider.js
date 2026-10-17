const NORMAL_TITLE = "ren's emporium";

const titleGroups = [
  {
    weight: 50,
    names: [
      "ren's emporium"
    ]
  },
  {
    weight: 25,
    names: [
      "ren semporium",
      "rens emporium",
      "rense mporium",
      "rensem porium",
      "rensemp orium",
      "rensempo rium",
      "rensempor ium"
    ]
  },
  {
    weight: 12.5,
    names: [
      "re nsemporium",
      "r ensemporium",
      "rensem pori um",
      "ren sem porium",
      "rens emp orium",
      "rense mpor ium",
      "ren se mporium",
      "r en semporium",
      "rensempo ri um",
      "rens empori um"
    ]
  },
  {
    weight: 6.25,
    names: [
      "Ren Semporium",
      "Rens Emporium",
      "Rensem Porium",
      "Ren S. Emporium",
      "R. Ensemporium",
      "Ren Semp Orium",
      "Rense M. Porium",
      "Ren Se-Mporium",
      "Ren Seporium",
      "Rensemp Orium"
    ]
  },
  {
    weight: 3.125,
    names: [
      "Ren Sem P. Orium",
      "Rens Emp Orium",
      "Rensem Porius",
      "Rensem Orium",
      "Ren Semporium",
      "Rensemporium",
      "Ren-semporium",
      "Rensem-porium",
      "Rensemp-orium",
      "Rensempor-ium"
    ]
  },
  {
    weight: 3.125,
    names: [
      "Port of Rensem Orium",
      "House of Ren Semporium",
      "Saint P. Orium of Rensem",
      "Rensem Porium",
      "Orium of Ren's Emp",
      "Ren's P. Orium",
      "Rens Porium",
      "Semporium of Ren",
      "Emporium Rensem",
      "Orium Rensemp"
    ]
  }
];

function pickWeightedGroup(groups) {
  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const group of groups) {
    roll -= group.weight;
    if (roll < 0) {
      return group;
    }
  }

  return groups[0];
}

function getUTCSeedParts() {
  const now = new Date();

  return {
    day: now.getUTCDate(),
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
    hour: now.getUTCHours()
  };
}

function getTitleIndex(listLength) {
  const { day, month, year, hour } = getUTCSeedParts();

  const dateHourSeed = (day * 1000000) + (month * 10000) + hour;
  const yearOffset = year % listLength;

  return (dateHourSeed + yearOffset) % listLength;
}

function setSiteTitle() {
  const titleLink = document.getElementById("site-title-link");
  if (!titleLink) return;

  const chosenGroup = pickWeightedGroup(titleGroups);
  const chosenIndex = getTitleIndex(chosenGroup.names.length);
  const chosenName = chosenGroup.names[chosenIndex];

  titleLink.textContent = chosenName;

  titleLink.addEventListener("mouseenter", function () {
    titleLink.textContent = NORMAL_TITLE;
  }, { once: true });
}

setSiteTitle();