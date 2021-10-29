/// <reference path="chrome.d.ts" />


var rootNode;
var parentId;

// Elements
const bookmarkDiv = document.getElementById('bookmarks');
const headerElem = document.querySelector('header');
const upBtn = document.getElementById('up-btn');

assignHandlers();

chrome.bookmarks.getTree(function (allNodes) {
    rootNode = allNodes[0];
    setActiveNode(rootNode);
});

function setActiveNode(node) {
    if (!!node.children & !!node.children.length) {
        parentId = node.parentId;
        bookmarkDiv.textContent = '';

        // chrome.storage.sync.set({'last-fetched': node.id});

        node.children.forEach(child => {
            if (!child.hasOwnProperty('url')) { // Check that it's a folder
                const div = buildHTMLForFolder(child);
                bookmarkDiv.append(div);
            }
        });
    }

    console.log(parentId);
    upBtn.classList.toggle('hide', !parentId && parentId !== 0);
}

function setActiveNodebyId(id) {
    chrome.bookmarks.getSubTree(id, result => {
        if (!!result && result.length) {
            setActiveNode(result[0]);
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

function clickFolder(e) {
    const folder = e.target.closest('.bookmark-folder');
    if (!!folder && !folder.classList.contains('ghosted')) {
        setActiveNodebyId(folder.dataset.id);
    }
}

function clickHeader(e) {
    const btn = e.target.closest('button');
    console.log("header clicked");
    console.log("btn: ", btn);
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
    bookmarkDiv.addEventListener('click', clickFolder);
    headerElem.addEventListener('click', clickHeader);
}