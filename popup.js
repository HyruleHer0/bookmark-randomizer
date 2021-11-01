/// <reference path="chrome.d.ts" />


/** Key for chrome's local storage */
const setsStorageKey = "saved-sets";
/** Dictionary of set name to array bookmark folder ids */
var allSets;
/** Id of the parent folder for the nodes currently being viewed */
let parentId;

// Elements
const setsList = document.querySelector('#sets-area ul');
const bookmarkTable = document.querySelector('#bookmarks > table');
const headerElem = document.querySelector('header');
const upBtn = document.getElementById('up-btn');

assignHandlers();

// let demoSetsTable = {
//     'demo': ['5', '62', '661']
// }
// chrome.storage.sync.set({[setsStorageKey]: demoSetsTable});



chrome.bookmarks.getTree(result => {
    console.log(result);
})



chrome.storage.sync.get(setsStorageKey, buildSetsTable);

function buildSetsTable(storageRsp) {
    allSets = storageRsp[setsStorageKey] || {};
    const createNewElem = setsList.querySelector('.create-new-set');

    // Populate the list
    Object.keys(allSets).forEach(key => {
        const li = document.createElement('li');
        li.textContent = key;
        li.classList.add('bm-set');
        setsList.insertBefore(li, createNewElem);
    });
}


function setActiveBMNode(node) {
    if (!!node.children & !!node.children.length) {
        parentId = node.parentId;
        bookmarkTable.textContent = '';

        // chrome.storage.sync.set({'last-fetched': node.id});

        node.children.forEach(child => {
            if (!child.hasOwnProperty('url')) { // Check that it's a folder
                const div = buildHTMLForFolder(child);
                bookmarkTable.append(div);
            }
        });
    }

    console.log(parentId);
    upBtn.classList.toggle('hide', !parentId && parentId !== 0);
}

function setActiveNodebyId(id) {
    chrome.bookmarks.getSubTree(id, result => {
        if (!!result && result.length) {
            setActiveBMNode(result[0]);
        }
    });
}

function buildHTMLForFolder(node) {
    const div = document.createElement('div');
    div.title = node.title;
    div.classList.add('bookmark-folder');
    div.dataset.id = node.id;

    if (isEndOfPath(node)) {
        div.classList.add('ghosted');
    }

    let bmCount = 0, folderCount = 0;
    node.children.forEach(grandchild => {
        if (grandchild.hasOwnProperty('url')) {
            bmCount++;
        }
        else {
            folderCount++;
        }
    });

    const title = document.createElement('span');
    title.textContent = node.title;
    title.classList.add('title');

    const childCount = document.createElement('span');
    childCount.textContent = `${folderCount} / ${bmCount}`;
    childCount.classList.add('child-count');

    div.appendChild(title);
    div.appendChild(childCount);

    return div;
}

function isEndOfPath(node) {
    return !node.children || node.children.length === 0 || node.children.every(n => {
        n.hasOwnProperty('url')
    });
}

function clickSet(e) {
    const set = e.target.closest('.bm-set');
    if (!!set) {
        if (set.classList.contains('new-set')) {
            // TODO New set logic
        }
        else {
            const setName = set.innerText;
            folderIds = allSets[setName];
            const promises = [];
            folderIds.forEach(id => {
                promises.push(chrome.bookmarks.getChildren(id));
            })
            Promise.all(promises).then((values) => {
                let allNodes = [];
                values.forEach((v) => {
                    allNodes = allNodes.concat(v);
                })
                const bookmarks = allNodes.filter(n => n.hasOwnProperty('url'));
                const randomIndex = Math.floor(Math.random() * allNodes.length) + 1;
                chrome.tabs.create({url: allNodes[randomIndex].url});
            });
        }
        e.stopPropagation();
    }
    
}

function clickFolder(e) {
    const folder = e.target.closest('.bookmark-folder');
    if (!!folder) {
        setActiveNodebyId(folder.dataset.id);
    }
}

function clickHeader(e) {
    const btn = e.target.closest('button');
    if (!!btn){
        switch (btn.id) {
            case ('up-btn') :
                console.log("up clicked")
                setActiveNodebyId(parentId);
                break;
        }
    }
}

function assignHandlers() {
    setsList.addEventListener('click', clickSet);
    // bookmarkTable.addEventListener('click', clickFolder);
    headerElem.addEventListener('click', clickHeader);
}