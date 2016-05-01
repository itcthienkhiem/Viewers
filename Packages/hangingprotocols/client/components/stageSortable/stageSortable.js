/**
 * Extend the Array prototype with a Swap function
 * so we can swap stages more easily
 */
Array.prototype.move = function(oldIndex, newIndex) {
    var value = this[oldIndex];

    newIndex = Math.max(0, newIndex);
    newIndex = Math.min(this.length, newIndex);

    this.splice(oldIndex, 1);
    this.splice(newIndex, 0, value);
    return this;
};

/**
 * Helper function to obtain the current index of a stage in the
 * current protocol
 *
 * @param protocol The Hanging Protocol to search within
 * @param id The id of the current stage to search for
 * @returns {number} The index of the specified stage within the Protocol,
 *                   or undefined if it is not present.
 */
function getStageIndex(protocol, id) {
    var stageIndex;
    protocol.stages.forEach(function(stage, index) {
        if (stage.id === id) {
            stageIndex = index;
            return false;
        }
    });

    return stageIndex;
}

Template.stageSortable.helpers({
    /**
     * Checks a specified stage to see if it is currently being displayed
     *
     * @returns {boolean} Whether or not the stage is currently being displayed
     */
    isActiveStage: function() {
        // Rerun this function every time the layout manager has been updated
        Session.get('LayoutManagerUpdated');

        // If no Protocol Engine has been defined yet, stop here to prevent errors
        if (!ProtocolEngine) {
            return;
        }

        var currentStage = ProtocolEngine.getCurrentStageModel();

        // Return a boolean representing if the active stage and the specified stage index are equal
        return (this.id === currentStage.id);
    },
    /**
     * Retrieves the index of the stage at the point it was last saved
     *
     * @returns {number|*}
     */
    stageLabel: function() {
        var stage = this;

        // If no Protocol Engine has been defined yet, stop here to prevent errors
        if (!ProtocolEngine) {
            return;
        }

        // Retrieve the last saved copy of the current protocol
        var lastSavedCopy = HangingProtocols.findOne(ProtocolEngine.protocol._id);

        // Try to find the index of this stage in the previously saved copy
        var stageIndex = getStageIndex(lastSavedCopy, stage.id);

        // If the stage is new, and therefore wasn't present in the last save,
        // retrieve it's index in the array of new stage ids and use that for
        // the label. Also include the time since it was created.
        if (stageIndex === undefined) {
            // Reactively update this helper every minute
            Session.get('timeAgoVariable');

            // Find the index of the stage in the array of newly created stage IDs
            var newStageNumber = ProtocolEngine.newStageIds.indexOf(stage.id) + 1;

            // Use Moment.js to format the createdDate of this stage relative to the
            // current time
            var dateCreatedFromNow = moment(stage.createdDate).fromNow();

            // Return the label for the new stage,
            // e.g. "New Stage 1 (created a few seconds ago)"
            return 'New Stage ' + newStageNumber + ' (created ' + dateCreatedFromNow + ')';
        }

        // If the stage is not new, label it by the index it held in the stages array
        // at the previous saved point
        return 'Stage ' + ++stageIndex;
    }
});

Template.stageSortable.events({
    /**
     * Displays a stage when its title is clicked
     */
    'click .sortable-item span': function() {
        // Retrieve the index of this stage in the display set sequences
        var stageIndex = getStageIndex(ProtocolEngine.protocol, this.id);

        // Display the selected stage
        ProtocolEngine.setCurrentProtocolStage(stageIndex);
    },
    /**
     * Creates a new stage and adds it to the currently loaded Protocol at
     * the end of the display set sequence
     */
    'click #addStage': function() {
        // Retrieve the model describing the current stage
        var stage = ProtocolEngine.getCurrentStageModel();

        // Clone this stage to create a new stage
        var newStage = stage.createClone();

        // Remove the stage's name if it has one
        delete newStage.name;

        // Append this new stage to the end of the display set sequence
        ProtocolEngine.protocol.stages.push(newStage);

        // Append the new stage the list of new stage IDs, so we can label it properly
        ProtocolEngine.newStageIds.push(newStage.id);

        // Calculate the index of the last stage in the display set sequence
        var stageIndex = ProtocolEngine.protocol.stages.length - 1;

        // Switch to the last stage in the display set sequence
        ProtocolEngine.setCurrentProtocolStage(stageIndex);
    },
    /**
     * Deletes a stage from the currently loaded Protocol by removing it from
     * the stages array. If it is the currently active stage, the current stage is
     * set to one stage earlier in the display set sequence.
     */
    'click .deleteStage': function() {
        // If this is the only stage in the Protocol, stop here
        if (ProtocolEngine.protocol.stages.length === 1) {
            return;
        }

        var stageId = this.id;

        var options = {
            title: 'Remove Protocol Stage',
            text: 'Are you sure you would like to remove this Protocol Stage? This cannot be reversed.'
        };

        showConfirmDialog(function() {
            // Retrieve the index of this stage in the display set sequences
            var stageIndex = getStageIndex(ProtocolEngine.protocol, stageId);

            // Remove it from the display set sequence
            ProtocolEngine.protocol.stages.splice(stageIndex, 1);

            // If we have removed the currently active stage, switch to the one before it
            if (ProtocolEngine.stage === stageIndex) {
                // Make sure we don't try to switch to a stage index below zero
                var newStageIndex = Math.max(stageIndex - 1, 0);

                // Display the new stage
                ProtocolEngine.setCurrentProtocolStage(newStageIndex);
            }

            // Update the Session variable to the UI re-renders
            Session.set('LayoutManagerUpdated', Random.id());
        }, options);
    }
});

Template.stageSortable.onRendered(function() {
    // Define the options for the Sortable plugin which is used
    // for drag-and-drop reordering of stages
    // See: https://github.com/RubaXa/Sortable/
    var originalOrder;
    var sortable = false;
    var stageSortableOptions = {
        sort: true,
        animation: 100,
        handle: '.sortable-handle',
        onStart: function() {
            // Store the original order before the onSort event fires
            originalOrder = sortable.toArray();
        },
        onSort: function(event) {
            // When the list is sorted, we will use this function to
            // reorder the Protocol's Stages inside the Protocol itself
            // and then let our autorun function below reset the DOM
            // after the list reactively updates

            // Store the current stage so we can make sure we stay on it
            var currentStage = ProtocolEngine.getCurrentStageModel();

            // Get the old and new indices following a 'sort' event
            var oldIndex = event.oldIndex;
            var newIndex = event.newIndex;

            // Swap the stages in the current Protocol's display set sequence
            // using our addition to the Array prototype
            ProtocolEngine.protocol.stages = ProtocolEngine.protocol.stages.move(oldIndex, newIndex);

            // If the currently displayed stage was reordered into a new position,
            // update the value for the stage index in the displayed Protocol
            ProtocolEngine.stage = getStageIndex(ProtocolEngine.protocol, currentStage.id);

            // Update the Session variable to the UI re-renders
            Session.set('LayoutManagerUpdated', Random.id());
        }
    };

    // Here we have two autorun functions which allow us to have a dynamic
    // (i.e. list elements are passed reactively to this template, and the
    // list automatically updates) list which is also sortable using Rubaxa's
    // Sortable plugin.
    this.autorun(function() {
        // This autorun function runs every time the Template data changes
        // It's sole purpose is to create the Sortable object from the data
        Template.currentData();

        // Retrieve the element to be enabled as a Sortable
        var element = document.getElementById('stageSortable');

        // Create the Sortable list with the specified options
        sortable = Sortable.create(element, stageSortableOptions);
    });

    this.autorun(function() {
        // This autorun function resets the DOM sorting performed by the
        // plugin. It fires immediately after the onSort event and its purpose
        // is to manually reset the Sortable plugin's representation of the DOM
        // to the state that was present at onStart.

        // This runs whenever the layout manager is updated
        Session.get('LayoutManagerUpdated');

        // If the sortable list is present and an original order is defined
        // (e.g. immediately after onSort)
        if (sortable && originalOrder) {
            // Undo the local DOM sorting using Sortable's sort function
            // and the stored order
            sortable.sort(originalOrder);

            // Erase the original order
            originalOrder = null;
        }
    });
});
