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
 * @returns {number} The index of the specified stage within the Protocol
 */
function getStageIndex(protocol, id) {
    var stageIndex = 0;
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

        // Retrieve the index of this stage in the display set sequences
        var stageIndex = getStageIndex(ProtocolEngine.protocol, this.id);

        var currentStage = ProtocolEngine.getCurrentStageModel();

        // Return a boolean representing if the active stage and the specified stage index are equal
        return (this.id === currentStage.id);
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
    'click .addStage': function() {
        // Retrieve the model describing the current stage
        var stage = ProtocolEngine.getCurrentStageModel();

        // Clone this stage to create a new stage
        var newStage = stage.createClone();

        // Remove the stage's name if it has one
        delete newStage.name;

        // Append this new stage to the end of the display set sequence
        ProtocolEngine.protocol.stages.push(newStage);

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
            originalOrder = sortable.toArray();
        },
        // event handler for reordering attributes
        onSort: function(event) {
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

    // Retrieve the element to be enabled as a Sortable
    var element = document.getElementById('stageSortable');

    // Create the Sortable list with the specified options
    sortable = Sortable.create(element, stageSortableOptions);

    this.autorun(function() {
        // re-runs when the order changes
        Session.get('LayoutManagerUpdated', Random.id());
        
        if (sortable && originalOrder) {
            // undo the local DOM sorting
            sortable.sort(originalOrder);
            originalOrder = null;
        }
    });
});
