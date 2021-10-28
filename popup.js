/// <reference path="chrome.d.ts" />


var rootNode;
const bookmarkDiv = document.getElementById('bookmarks');
bookmarkDiv.addEventListener('click', clickFolder);

chrome.bookmarks.getTree(function (allNodes) {
    rootNode = allNodes[0];
    displayChildren(rootNode);
});

function displayChildren(node) {
    if (!!node && !!node.children & !!node.children.length) {
        node.children.forEach(child => {
            if (!node.hasOwnProperty('url')) { // Check that it's a folder
                const div = document.createElement('div');
                div.classList.add('bookmark-folder');
                div.textContent = child.title;
                div.dataset.id = child.id;
                bookmarkDiv.append(div);
            }
        });
    }
    else {
        bookmarkDiv.innerText = "Nothing to display";
    }
}

function clickFolder(e) {
    const folder = e.target.closest('.bookmark-folder');
    if (!!folder) {
        chrome.bookmarks.getChildren(folder.dataset.id, result => {
            if (!!result) { 
                displayChildren(result[0]);
            }
            else {
                console.error(`Failed to fetch bookmark node id ${folder.dataset.id}. ${result}`);
            }
        });
    }
}