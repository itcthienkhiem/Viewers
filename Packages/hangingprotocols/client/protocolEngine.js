ProtocolEngine = undefined;

HP.setEngine = function(protocolEngine) {
    ProtocolEngine = protocolEngine;
};

HP.CustomAttributeRetrievalCallbacks = {};

HP.addCustomAttribute = function(attributeId, attributeName, callback) {
    HP.CustomAttributeRetrievalCallbacks[attributeId] = {
        name: attributeName,
        callback: callback
    };
};

// Log decisions regarding matching
HP.match = function(attributes, rules) {
    var options = {
        format: 'grouped'
    };

    var score = 0;
    var details = {
        passed: [],
        failed: []
    };

    var requiredFailed = false;

    rules.forEach(function(rule) {
        var attribute = rule.attribute;

        // If the attributes we are testing (e.g. study, series, or instance attributes) do
        // not contain the attribute specified in the rule, check whether or not they have been
        // defined in the CustomAttributeRetrievalCallbacks Object.

        // TODO: Investigate why attributes.hasOwnProperty(attribute) doesn't work?
        if (attributes[attribute] === undefined &&
            HP.CustomAttributeRetrievalCallbacks.hasOwnProperty(attribute)) {
            var customAttribute = HP.CustomAttributeRetrievalCallbacks[attribute];
            attributes[attribute] = customAttribute.callback(attributes);
        }

        // Format the constraint as required by Validate.js
        var testConstraint = {};
        testConstraint[attribute] = rule.constraint;

        // Use Validate.js to evaluate the constraints on the specified attributes
        var errorMessages = validate(attributes, testConstraint, [options]);

        if (!errorMessages) {
            // If no errorMessages were returned, then validation passed.

            // Add the rule's weight to the total score
            score += rule.weight;

            // Log that this rule passed in the matching details object
            details.passed.push({
                rule: rule
            });
        } else {
            // If errorMessages were present, then validation failed

            // If the rule that failed validation was Required, then
            // mark that a required Rule has failed
            if (rule.required) {
                requiredFailed = true;
            }

            // Log that this rule failed in the matching details object
            // and include any error messages
            details.failed.push({
                rule: rule,
                errorMessages: errorMessages
            });
        }
    });

    // If a required Rule has failed Validation, set the matching score to zero
    if (requiredFailed) {
        score = 0;
    }

    return {
        score: score,
        details: details
    };
};

var sortByScore = function(arr) {
    arr.sort(function(a, b) {
        return b.score - a.score;
    });
};

HP.ProtocolEngine = class ProtocolEngine {
    constructor(LayoutManager, studies) {
        this.LayoutManager = LayoutManager;
        this.studies = studies;

        this.reset();

        // Create an array for new stage ids to be stored
        // while editing a stage
        this.newStageIds = [];
    }

    /**
     * Resets the ProtocolEngine to the best match
     */
    reset() {
        var protocol = this.getBestMatch();
        this.setHangingProtocol(protocol);
    }

    /**
     * Retrieves the current Stage from the current Protocol and stage index
     *
     * @returns {*} The Stage model for the currently displayed Stage
     */
    getCurrentStageModel() {
        return this.protocol.stages[this.stage];
    }

    findMatchByStudy(study) {
        var matched = [];

        var self = this;
        HangingProtocols.find().forEach(function(protocol) {
            var rules = protocol.protocolMatchingRules;
            if (!rules || !rules.length) {
                return;
            }

            study.numberOfPriorsReferenced = self.getNumberOfAvailablePriors(study);
            var rule = new HP.ProtocolMatchingRule('numberOfPriorsReferenced', {
                numericality: {
                    greaterThanOrEqualTo: protocol.numberOfPriorsReferenced
                }
            });

            rules.push(rule);

            var matchedDetails = HP.match(study, rules);

            if (matchedDetails.score > 0) {
                matched.push({
                    score: matchedDetails.score,
                    protocol: protocol
                });
            }            
        });

        if (!matched.length) {
            var defaultProtocol = HangingProtocols.findOne({
                id: 'defaultProtocol'
            });

            return [{
                score: 1,
                protocol: defaultProtocol
            }];
        }

        sortByScore(matched);
        return matched;
    }

    /**
     * Populates the MatchedProtocols Collection by running the matching procedure
     */
    updateMatches() {
        var self = this;

        // Clear all data from the MatchedProtocols Collection
        MatchedProtocols.remove({});

        // For each study, find the matching protocols
        this.studies.forEach(function(study) {
            var matched = self.findMatchByStudy(study);

            // For each matched protocol, check if it is already in MatchedProtocols
            matched.forEach(function(matchedDetail) {
                var protocol = matchedDetail.protocol;
                var protocolInCollection = MatchedProtocols.findOne({
                    id: protocol.id
                });

                // If it is not already in the MatchedProtocols Collection, insert it
                if (!protocolInCollection) {
                    MatchedProtocols.insert(protocol);
                }
            });
        });
    }

    /**
     * Return the best matched Protocol to the current study or set of studies
     * @returns {*}
     */
    getBestMatch() {
        // Run the matching to populate the MatchedProtocols Collection
        this.updateMatches();

        // Retrieve the highest scoring Protocol
        var sorted = MatchedProtocols.find({}, {
            sort: {
                score: -1
            },
            limit: 1
        }).fetch();

        // Return the highest scoring Protocol
        return sorted[0];
    }

    getNumberOfAvailablePriors(study) {
        var studies = WorklistStudies.find({
            patientId: study.patientId,
            studyDate: {
                $lt: study.studyDate
            }
        });

        return studies.count();
    }

    findRelatedStudies(protocol, study) {
        if (!protocol.protocolMatchingRules) {
            return;
        }
        
        var studies = WorklistStudies.find({
            patientId: study.patientId,
            studyDate: {
                $lt: study.studyDate
            }
        }, {
            sort: {
                studyDate: -1
            }
        });

        var related = [];
        var currentDate = moment(study.studyDate, 'YYYYMMDD');

        studies.forEach(function(priorStudy, priorIndex) {
            // Calculate an abstract prior value for the study in question
            if (priorIndex === (studies.length - 1)) {
                priorStudy.abstractPriorValue = -1;
            } else {
                priorStudy.abstractPriorValue = priorIndex;
            }

            // Calculate the relative time using Moment.js
            var priorDate = moment(priorStudy.studyDate, 'YYYYMMDD');
            priorStudy.relativeTime = currentDate.diff(priorDate);

            var details = HP.match(priorStudy, protocol.protocolMatchingRules);
            if (details.score) {
                related.push({
                    score: details.score,
                    study: priorStudy
                });
            }
        });

        sortByScore(related);
        return related.map(function(v) {
            return v.study;
        });
    }

    // Match images given a list of Studies and a Viewport's image matching reqs
    matchImages(viewport) {
        var studyMatchingRules = viewport.studyMatchingRules;
        var seriesMatchingRules = viewport.seriesMatchingRules;
        var instanceMatchingRules = viewport.imageMatchingRules;

        var highestStudyMatchingScore = 0;
        var highestSeriesMatchingScore = 0;
        var highestImageMatchingScore = 0;
        var matchingScores = [];
        var bestMatch;

        var currentStudy = this.studies[0];
        currentStudy.abstractPriorValue = 0;

        var self = this;
        studyMatchingRules.forEach(function(rule) {
            if (rule.attribute === 'abstractPriorValue') {
                var validatorType = Object.keys(rule.constraint)[0];
                var validator = Object.keys(rule.constraint[validatorType])[0];
                var abstractPriorValue = rule.constraint[validatorType][validator];
                abstractPriorValue = parseInt(abstractPriorValue, 10);
                // TODO: Restrict or clarify validators for abstractPriorValue?

                var studies = WorklistStudies.find({
                    patientId: currentStudy.patientId,
                    studyDate: {
                        $lt: currentStudy.studyDate
                    }
                }, {
                    sort: {
                        studyDate: -1
                    }
                }).fetch();

                // TODO: Revisit this later: What about two studies with the same
                // study date?

                var priorStudy;
                if (abstractPriorValue === -1) {
                    priorStudy = studies[studies.length - 1];
                } else {
                    var studyIndex = Math.max(abstractPriorValue - 1, 0);
                    priorStudy = studies[studyIndex];
                }

                if (!priorStudy) {
                    return;
                }

                var alreadyLoaded = ViewerStudies.findOne({
                    studyInstanceUid: priorStudy.studyInstanceUid
                });

                if (!alreadyLoaded) {
                    getStudyMetadata(priorStudy.studyInstanceUid, function(study) {
                        study.abstractPriorValue = abstractPriorValue;

                        ViewerStudies.insert(study);
                        self.studies.push(study);
                        self.matchImages(viewport);
                        self.updateViewports(viewport);
                    });
                }
            }
            // TODO: Add relative Date / time
        });

        var lastStudyIndex = this.studies.length - 1;
        this.studies.forEach(function(study) {
            var studyMatchDetails = HP.match(study, studyMatchingRules);
            if ((studyMatchingRules.length && !studyMatchDetails.score) ||
                studyMatchDetails.score < highestStudyMatchingScore) {
                return;
            }

            highestStudyMatchingScore = studyMatchDetails.score;

            study.seriesList.forEach(function(series) {
                var seriesMatchDetails = HP.match(series, seriesMatchingRules);
                if ((seriesMatchingRules.length && !seriesMatchDetails.score) ||
                    seriesMatchDetails.score < highestSeriesMatchingScore) {
                    return;
                }

                highestSeriesMatchingScore = seriesMatchDetails.score;

                series.instances.forEach(function(instance, index) {
                    // This tests to make sure there is actually image data in this instance
                    // TODO: Change this when we add PDF and MPEG support
                    // See https://ohiforg.atlassian.net/browse/LT-227
                    if (!instance.rows || !instance.columns) {
                        return;
                    }

                    var instanceMatchDetails = HP.match(instance, instanceMatchingRules);

                    var matchDetails = {
                        passed: [],
                        failed: []
                    };

                    matchDetails.passed = matchDetails.passed.concat(instanceMatchDetails.details.passed);
                    matchDetails.passed = matchDetails.passed.concat(seriesMatchDetails.details.passed);
                    matchDetails.passed = matchDetails.passed.concat(studyMatchDetails.details.passed);

                    matchDetails.failed = matchDetails.failed.concat(instanceMatchDetails.details.failed);
                    matchDetails.failed = matchDetails.failed.concat(seriesMatchDetails.details.failed);
                    matchDetails.failed = matchDetails.failed.concat(studyMatchDetails.details.failed);

                    var totalMatchScore = instanceMatchDetails.score + seriesMatchDetails.score + studyMatchDetails.score;

                    var imageDetails = {
                        studyInstanceUid: study.studyInstanceUid,
                        seriesInstanceUid: series.seriesInstanceUid,
                        sopInstanceUid: instance.sopInstanceUid,
                        currentImageIdIndex: index,
                        matchingScore: totalMatchScore,
                        matchDetails: matchDetails
                    };

                    if ((totalMatchScore > highestImageMatchingScore) || !bestMatch) {
                        highestImageMatchingScore = totalMatchScore;
                        bestMatch = imageDetails;
                    }

                    matchingScores.push(imageDetails);
                });
            });
        });

        return {
            bestMatch: bestMatch,
            matchingScores: matchingScores
        };
    }

    // Redraw viewports given stage
    updateViewports(viewportIndex) {
        if (!this.protocol || !this.protocol.stages || !this.protocol.stages.length) {
            return;
        }

        var stageModel = this.getCurrentStageModel();
        if (!stageModel ||
            !stageModel.viewportStructure ||
            !stageModel.viewports ||
            !stageModel.viewports.length) {
            return;
        }

        var layoutTemplateName = stageModel.viewportStructure.getLayoutTemplateName();
        if (!layoutTemplateName) {
            return;
        }

        var layoutProps = stageModel.viewportStructure.properties;
        if (!layoutProps) {
            return;
        }

        var viewports = stageModel.viewports;

        var viewportData = [];

        this.matchDetails = [];

        var self = this;
        viewports.forEach(function(viewport, viewportIndex) {
            var details = self.matchImages(viewport);
            self.matchDetails[viewportIndex] = details;

            // imageViewerViewports occasionally needs relevant layout data in order to set
            // the element style of the viewport in question
            var currentViewportData = $.extend({
                viewportIndex: viewportIndex,
                viewport: viewport.viewportSettings,
                toolSettings: viewport.toolSettings
            }, layoutProps);

            if (details.bestMatch) {
                currentViewportData.studyInstanceUid = details.bestMatch.studyInstanceUid;
                currentViewportData.seriesInstanceUid = details.bestMatch.seriesInstanceUid;
                currentViewportData.sopInstanceUid = details.bestMatch.sopInstanceUid;
                currentViewportData.currentImageIdIndex = details.bestMatch.currentImageIdIndex;
            }

            viewportData.push(currentViewportData);
        });

        this.LayoutManager.layoutTempleName = layoutTemplateName;
        this.LayoutManager.layoutProps = layoutProps;
        this.LayoutManager.viewportData = viewportData;

        if (viewportIndex === undefined) {
            this.LayoutManager.updateViewports();
        } else if (viewportData[viewportIndex]) {
            this.LayoutManager.rerenderViewportWithNewSeries(viewportIndex, viewportData[viewportIndex]);
        }

    }

    /**
     * Sets the current Hanging Protocol to the specified Protocol
     * An optional argument can also be used to prevent the updating of the Viewports
     *
     * @param newProtocol
     * @param updateViewports
     */
    setHangingProtocol(newProtocol, updateViewports=true) {
        // Reset the array of newStageIds
        this.newStageIds = [];

        if (HP.Protocol.prototype.isPrototypeOf(newProtocol)) {
            this.protocol = newProtocol;
        } else {
            this.protocol = new HP.Protocol();
            this.protocol.fromObject(newProtocol);
        }

        this.stage = 0;

        // Update viewports by default
        if (updateViewports) {
            this.updateViewports();
        }

        MatchedProtocols.update({}, {
            $set: {
                selected: false
            }
        }, {
            multi: true
        });

        MatchedProtocols.update({
            id: this.protocol.id
        }, {
            $set: {
                selected: true
            }
        });
    }

    /**
     * Changes the current stage to a new stage index in the display set sequence
     *
     * @param newStage An integer value specifying the index of the desired Stage
     */
    setCurrentProtocolStage(stage) {
        if (!this.protocol || !this.protocol.stages || !this.protocol.stages.length) {
            return;
        }

        if (stage >= this.protocol.stages.length) {
            return;
        }

        this.stage = stage;
        this.updateViewports();
    }

    /**
     * Retrieves the number of Stages in the current Protocol
     */
    getNumProtocolStages() {
        if (!this.protocol || !this.protocol.stages || !this.protocol.stages.length) {
            return;
        }

        return this.protocol.stages.length;
    }

    /**
     * Switches to the next protocol stage in the display set sequence
     */
    nextProtocolStage() {
        this.setCurrentProtocolStage(++this.stage);
    }

    /**
     * Switches to the previous protocol stage in the display set sequence
     */
    previousProtocolStage() {
        this.setCurrentProtocolStage(--this.stage);
    }
};
