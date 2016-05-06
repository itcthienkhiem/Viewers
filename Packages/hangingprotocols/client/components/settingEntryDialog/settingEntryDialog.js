var keys = {
    ESC: 27
};

/**
 * Close the specified dialog element and return browser
 * focus to the active viewport.
 *
 * @param dialog The DOM element of the dialog to close
 */
function closeHandler(dialog) {
    // Hide the lesion dialog
    $(dialog).css('display', 'none');

    // Remove the backdrop
    $('.removableBackdrop').remove();

    // Restore the focus to the active viewport
    setFocusToActiveViewport();
}

/**
 * Displays and updates the UI of the Setting Entry Dialog given a new set of
 * attributes, the setting level (protocol, study, series, or instance), and an
 * optional setting to edit.
 *
 * @param attributes List of attributes the user can set
 * @param level Level of the Setting to create / edit
 * @param setting Optional Setting
 */
openSettingEntryDialog = function(setting) {
    // Get the lesion location dialog
    var dialog = $('.settingEntryDialog');

    // Clear any input that is still on the page
    var currentValueInput = dialog.find('input.currentValue');
    currentValueInput.val('');

    // Store the Dialog DOM data, setting level and setting in the template data
    Template.settingEntryDialog.dialog = dialog;
    Template.settingEntryDialog.setting = setting;

    // Initialize the Select2 search box for the attribute list
    var attributes = Object.keys(HP.displaySettings);
    attributes.concat(Object.keys(HP.CustomViewportSettings));
    var attributeSelect = dialog.find('.attributes');
    attributeSelect.html('').select2({
        data: attributes,
        placeholder: 'Select an attribute',
        allowClear: true
    });

    var options = [];
    var valueSelect = dialog.find('.currentValue');
    valueSelect.html('').select2({
        data: options,
        placeholder: 'Select an attribute',
        allowClear: true
    });

    // If a setting has been provided, set the value of the attribute Select2 input
    // to the attribute set in the setting.
    if (setting && setting.attribute) {
        attributeSelect.val(setting.attribute);
    }

    // Trigger('change') is used to update the Select2 choice in the UI and so
    // that the currentValue is updated based on the current attribute
    attributeSelect.trigger('change');

    // If a setting has been provided, display its current value
    if (setting) {
        currentValueInput.val(setting.value);
    }

    // Update the dialog's CSS so that it is visible on the page
    dialog.css('display', 'block');

    // Show the backdrop
    Blaze.render(Template.removableBackdrop, document.body);

    // Make sure the context menu is closed when the user clicks away
    $('.removableBackdrop').one('mousedown touchstart', function() {
        closeHandler(dialog);
    });
};

Template.settingEntryDialog.onCreated(function() {
    // Define the ReactiveVars that will be used to link aspects of the UI
    var template = this;

    // Note: currentValue's initial value must be a string so the template renders properly
    template.currentValue = new ReactiveVar('');
    template.attribute = new ReactiveVar();
});

Template.settingEntryDialog.helpers({
    /**
     * Reactively updates the current value of the selected attribute for the selected image
     *
     * @returns {*} Attribute value for the active image
     */
    currentValue: function() {
        return Template.instance().currentValue.get();
    }
});

Template.settingEntryDialog.events({
    /**
     * Save a setting that is being edited
     *
     * @param event the Click event
     * @param template The template context
     */
    'click #save': function(event, template) {
        // Retrieve the input properties to the template
        var dialog = Template.settingEntryDialog.dialog;

        // Retrieve the current values for the attribute value and comparatorId
        var attribute = template.attribute.get();
        var currentValue = template.currentValue.get();

        // If currentValue input is undefined, prevent saving this setting
        if (currentValue === undefined) {
            return;
        }

        // Check if we are editing a setting or creating a new one
        var setting;
        if (Template.settingEntryDialog.setting) {
            // If we are editing a setting, change the setting data
            setting = Template.settingEntryDialog.setting;
        } else {
            // If we are creating a setting, obtain the active Viewport model
            // from the Protocol and Stage
            var viewport = getActiveViewportModel();

            setting = {
                id: attribute,
                value: currentValue
            };

            viewport.viewportSettings[id] = setting;
        }

        // Instruct the Protocol Engine to update the Layout Manager with new data
        var viewportIndex = Session.get('activeViewport');
        ProtocolEngine.updateViewports(viewportIndex);

        // Close the dialog
        closeHandler(dialog);
    },
    /**
     * Allow the user to click the Cancel button to close the dialog
     */
    'click #cancel': function() {
        var dialog = Template.settingEntryDialog.dialog;
        closeHandler(dialog);  
    },
    /**
     * Allow Esc keydown events to close the dialog
     *
     * @param event The Keydown event details
     * @returns {boolean} Return false to prevent bubbling of the event
     */
    'keydown .settingEntryDialog': function(event) {
        var dialog = Template.settingEntryDialog.dialog;

        // If Esc key is pressed, close the dialog
        if (event.which === keys.ESC) {
            closeHandler(dialog);
            return false;
        }
    },
    /**
     * Update the currentValue ReactiveVar if the user changes the attribute
     *
     * @param event The Change event for the select box
     * @param template The current template context
     */
    'change select.attributes': function(event, template) {
        // Obtain the user-specified attribute to test against
        var attribute = $(event.currentTarget).val();

        // Store it in the ReactiveVar
        template.attribute.set(attribute);

        // Store this attribute in the template data context
        Template.settingEntryDialog.selectedAttribute = attribute;

        // Retrieve the current value from the attribute
        var settingData = HP.displaySettings[attribute];

        var options = settingData.options;
        var dialog = Template.settingEntryDialog.dialog;
        var valueSelect = dialog.find('.currentValue');
        valueSelect.html('').select2({
            data: options,
            placeholder: 'Select a value',
            allowClear: true
        });

        // Update the ReactiveVar with the user-specified value
        template.currentValue.set(settingData.default);
    },
    /**
     * Update the currentValue ReactiveVar if the user changes the attribute value
     *
     * @param event The Change event for the input
     * @param template The current template context
     */
    'change select.currentValue': function(event, template) {
        // Get the current value of the select box
        var value = $(event.currentTarget).val();

        // Update the ReactiveVar with the user-specified value
        template.currentValue.set(value);
    }
});
