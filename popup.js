/// <reference path="chrome.d.ts" />

function main() {
    /** Key for chrome's local storage for saved sets */
    const setsStorageKey = "saved-sets";
    /** Key for chrome's local storage for logs */
    const logStorageKey = "logs";
    /** Max number of logged actions to keep */
    const maxLogs = 100;
    /** Max characters allowed as a set name */
    const maxSetName = 40;
    /** Names that the user cannot use to name a set */
    const reservedSetNames = ['Create New', 'Random-All'];
    /** Dictionary of set name to array bookmark folder ids */
    var allSets;
    /** The new set being created, or the existing set being edited. */
    var currentSet;
    /** The current chrome bookmarks node being viewed. */
    var currentNode;
    /** If the app is busy animating between the sets and bookmark folder panes */
    var isBusyAnimating = false;

    // Elements
    const $setsArea = document.querySelector('#sets-area');
    const $bookmarksList = document.querySelector('#bookmarks-area .bookmarks-list');
    const $bookmarkNav = document.querySelector('#bookmarks-area .navigation-area');
    const $headerElem = document.querySelector('header');
    const $newSetNameInput = document.querySelector('header .new-set-name');
    const $createNewElem = $setsArea.querySelector('.create-new-set');

    assignHandlers();

    chrome.storage.sync.get(setsStorageKey, buildSetsList);

    function buildSetsList(storageRsp) {
        allSets = storageRsp[setsStorageKey] || {};

        clearSetsList();
        Object.keys(allSets).forEach(key => {
            const setElem = buildHTMLForSet(key);
            $setsArea.insertBefore(setElem, $createNewElem);
        });
    }

    function clearSetsList() {
        while ($setsArea.firstChild !== $createNewElem) {
            $setsArea.removeChild($setsArea.firstChild);
        }
    }

    function setActiveNode(node) {
        if (isBusyAnimating){
            setTimeout(() => setActiveNode(node), 400);
        }
        if (!!node.children & !!node.children.length) {
            currentNode = node;
            const navElem = document.querySelector("#bookmarks-area > .navigation-area");
            navElem.classList.toggle('at-root', !node.hasOwnProperty('parentId'));

            const navText = document.querySelector("#bookmarks-area > .navigation-area > span");
            navText.innerText = `Viewing Folder: ${node.parentId ? node.title : 'Root'}`;

            clearBookmarkFolders();
            node.children.forEach(child => {
                if (!child.hasOwnProperty('url')) { // Check that it's a folder
                    const bookmarkElem = buildHTMLForFolder(child);
                    $bookmarksList.append(bookmarkElem);
                }
            });
        }
    }

    function clearBookmarkFolders() {
        while ($bookmarksList.children.length > 0) {
            $bookmarksList.removeChild($bookmarksList.firstChild);
        }
        // $bookmarksList.textContent = ''; // TODO: check if clearing this another way helps height
    }

    function setActiveNodebyId(id) {
        chrome.bookmarks.getSubTree(id, result => {
            if (!!result && result.length) {
                setActiveNode(result[0]);
            }
        });
    }

    function buildHTMLForSet(setName) {
            const setElem = document.createElement('div');
            setElem.classList.add('set-item');
            setElem.dataset.setName = setName;

            const setNameElem = document.createElement('span');
            setNameElem.innerText = setName;

            const editBtn = document.createElement('i');
            editBtn.classList.add('fas', 'fa-wrench');
            editBtn.title = 'Edit';

            const delBtn = document.createElement('i');
            delBtn.classList.add('fas', 'fa-trash-alt');
            delBtn.title = 'Delete';

            const btnContainer = document.createElement('span');
            btnContainer.classList.add('buttons');

            btnContainer.append(editBtn, delBtn);
            setElem.append(setNameElem, btnContainer);
            return setElem;
    }

    function buildHTMLForFolder(node) {
        // Count the number of bookmark and folder children for the node
        let bmCount = 0, folderCount = 0;
        node.children.forEach(grandchild => {
            if (grandchild.hasOwnProperty('url')) {
                bmCount++;
            }
            else {
                folderCount++;
            }
        });

        const folderElem = document.createElement('div');
        folderElem.dataset.id = node.id;
        folderElem.dataset.folders = folderCount;
        folderElem.classList.add('bookmark-folder');

        if (currentSet.ids.indexOf(node.id) > -1) {
            folderElem.classList.add('selected');
        }

        const folderNameElem = document.createElement('span');
        folderNameElem.innerText = node.title;

        const btnContainer = document.createElement('span');
        btnContainer.classList.add('buttons');

        const childInfoElem = document.createElement('div');
        childInfoElem.classList.add('child-info');
        childInfoElem.title = `${folderCount} Folders / ${bmCount} Bookmarks`;

        const folderCountElem = document.createElement('div');
        folderCountElem.innerHTML = `<div>${folderCount} <i class="fas fa-folder"></i></div>`;

        const bmCountElem = document.createElement('div');
        bmCountElem.innerHTML = `<div>${bmCount} <i class="fas fa-bookmark"></i></div>`;

        childInfoElem.append(folderCountElem, bmCountElem);
        btnContainer.append(childInfoElem);

        const stepDownElem = document.createElement('i');
        stepDownElem.classList.add('fas', 'fa-level-down-alt');
        stepDownElem.title = "View subfolders";
        btnContainer.appendChild(stepDownElem);

        if (folderCount === 0) {
            stepDownElem.classList.add('disabled');
        }

        folderElem.append(folderNameElem, btnContainer);
        return folderElem;
    }

    function openSetEditor(setName) {
        // A setname provided means that this is an edit. If omitted, this is a new set
        if (!!setName) {
            currentSet = {name: setName, ids: allSets[setName]};
            setHeaderStatus(true, setName);
        }
        else {
            currentSet = {name: '', ids: []};
            setHeaderStatus(true, '');
        }

        chrome.bookmarks.getTree(result => {
            setActiveNode(result[0]);
            animateTransition(true);
        });
    }

    function closeSetEditor() {
        setHeaderStatus(false, '');

        currentSet = undefined;
        $newSetNameInput.value = '';

        chrome.storage.sync.get(setsStorageKey, (response) => {
            buildSetsList(response);
            animateTransition(false);
        });
    }

    function animateTransition(isOpening) {
        isBusyAnimating = true;

        if (isOpening) {
            $setsArea.classList.add('hide');
            setTimeout(() => {
                clearSetsList();
                isBusyAnimating = false;
            }, 400);
        }
        else {
            $setsArea.classList.remove('hide');
            setTimeout(() => {
                clearBookmarkFolders();
                isBusyAnimating = false;
            }, 400 );
        }
    }

    function setHeaderStatus(isEditingOrCreating, setName) {
        const statusArea = document.querySelector("header .status-area");

        if (isEditingOrCreating) {
            statusArea.classList.toggle('no-folders', currentSet.ids.length === 0);

            if (!!setName) {
                statusArea.classList.add('is-editing');
                const statusTextElem = document.querySelector("header .status-text");
                statusTextElem.innerText = 'Editing ';
                const setNameElem = document.createElement("span");
                setNameElem.classList.add('emphasis');
                setNameElem.innerText = setName;
                statusTextElem.appendChild(setNameElem);
            }
            else {
                statusArea.classList.add('is-creating');
            }
        }
        else {
            statusArea.classList.remove('is-creating', 'is-editing');
            document.querySelector("header .status-text").textContent = 'Viewing Saved Sets';
        }    
    }

    function deleteSet(setName) {
        delete allSets[setName];
        chrome.storage.sync.set({[setsStorageKey]: allSets}, () => {
            chrome.storage.sync.get(setsStorageKey, buildSetsList);
        });
    }

    function clickSet(e) {
        const set = e.target.closest('.set-item');
        const btn = e.target.closest('i');
        if (!set) {
            return;
        }
        if (!!btn) {
            switch (btn.title) {
                case 'Edit':
                    openSetEditor(set.dataset.setName);
                    break;
                case 'Delete':
                    deleteSet(set.dataset.setName);
                    break;
            }
        }
        else {
            if (set.classList.contains('create-new-set')) {
                openSetEditor('');
            }
            else if (set.classList.contains('random-all')) {
                goToRandomFromAllBookmarks();
            }
            else {
                goToRandomURLFromSet(set.innerText);
            }
        }
    }

    function clickFolder(e) {
        const folder = e.target.closest('.bookmark-folder');
        const subFolderBtn = e.target.closest('i.fa-level-down-alt');
        if (!folder) {
            return;
        }
        if (!!subFolderBtn) {
            if (parseInt(folder.dataset.folders) > 0) {
                setActiveNodebyId(folder.dataset.id);
            }
        }
        else {    
            const index = currentSet.ids.indexOf(e.target.dataset.id);

            if (index > -1) {
                currentSet.ids.splice(index, 1);
                const statusArea = document.querySelector("header .status-area");
                statusArea.classList.toggle('no-folders', currentSet.ids.length === 0);
            }
            else {
                currentSet.ids.push(folder.dataset.id);
            }

            folder.classList.toggle('selected', index === -1);
        }
        
    }

    function validateInput(value) {
        return !!value && value.length < maxSetName && value in allSets === false && reservedSetNames.indexOf(value) === -1;
    }

    function clickHeader(e) {
        const btn = e.target.closest('i');
        if (!!btn) {
            if (btn.classList.contains('fa-save')) {
                if (!currentSet.name) {
                    const inputValue = document.querySelector('header .new-set-name').value;
                    
                    if (!validateInput(inputValue) || currentSet.ids.length === 0) {
                        return;
                    }

                    currentSet.name = inputValue;
                }

                allSets[currentSet.name] = currentSet.ids;
                chrome.storage.sync.set({[setsStorageKey]: allSets}, () => {
                    closeSetEditor();
                });
            }
            else if (btn.classList.contains('fa-window-close')) {
                closeSetEditor();
            }
        }
    }

    function clickNavArea(e) {
        const btn = e.target.closest('.fa-arrow-up');
        if (!!btn) {
            setActiveNodebyId(currentNode.parentId);
        }
    }

    function assignHandlers() {
        $setsArea.addEventListener('click', clickSet);
        $bookmarksList.addEventListener('click', clickFolder);
        $bookmarkNav.addEventListener('click', clickNavArea);
        $headerElem.addEventListener('click', clickHeader);
        $newSetNameInput.addEventListener('input', onInputChanged);
    }

    function logAction(msg) {
        chrome.storage.sync.get(logStorageKey, (result) => {
            const logs = result[logStorageKey] || [];
            const newLog = {timeStamp: Date.now(), msg};

            // If we have room, insert a new log
            if (logs.length <= maxLogs) {
                logs.push(newLog);
            }
            else {
                // Otherwise, find the first instance of a log at a higher index with a timestamp older
                // Than the previous index, and replace it. This should result in a circular queue.
                let insertIndex = 0;
                for (i = 0; i < logs.length - 1; i++) {
                    if (logs[i].timeStamp > logs[i + 1].timeStamp) {
                        insertIndex = i + 1;
                        break;
                    }
                }
                logs.splice(insertIndex, 1, newLog);
            }

            chrome.storage.sync.set({[logStorageKey]: logs});
        });
    }

    function onInputChanged(e) {
        e.target.parentElement.classList.toggle('invalid-input', !validateInput(e.target.value));
    }

    function goToRandomURLFromSet(setName) {
        folderIds = allSets[setName];
        const promises = [];

        folderIds.forEach(id => {
            try {
                const promise = chrome.bookmarks.getChildren(id);
                promises.push(promise);
            }
            catch (err) {
                console.error(error);
            }
        });

        Promise.all(promises).then((values) => {
            let allNodes = [];
            values.forEach((v) => {
                allNodes = allNodes.concat(v);
            });

            const bookmarks = allNodes.filter(n => n.hasOwnProperty('url'));
            const randomIndex = Math.floor(Math.random() * bookmarks.length) + 1;
            const randomURL = bookmarks[randomIndex].url;

            logAction(`Attempting to navigate to the random URL: ${randomURL}`);
            chrome.tabs.create({url: randomURL});
        });
    }

    function goToRandomFromAllBookmarks() {
        let allBookMarks = [];
        let folderStack = [];
        chrome.bookmarks.getTree(result => {
            let node = result[0];
            separateFoldersAndBookmarks(node, allBookMarks, folderStack);

            while (folderStack.length > 0) {
                node = folderStack.pop();
                separateFoldersAndBookmarks(node, allBookMarks, folderStack);
            }

            const randomIndex = Math.floor(Math.random() * allBookMarks.length) + 1;
            const randomURL = allBookMarks[randomIndex].url;

            logAction(`Attempting to navigate to the random URL: ${randomURL}`);
            chrome.tabs.create({url: randomURL});

        });
    }

    function separateFoldersAndBookmarks(node, bookmarks, folders) {
        node.children.forEach(c => {
            if (c.hasOwnProperty('url')) {
                bookmarks.push(c);
            }
            else {
                folders.push(c);
            }
        });
    }
}
main();
