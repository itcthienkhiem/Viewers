HP.attributeDefaults = {
    abstractPriorValue: 0
};

HP.viewportSettingsTypes = {
    /*scale: {
     id: 'scale',
     name: 'Scale',
     values: {
     scale: {
     default: 1.0,
     min: 0.05,
     max: 20,
     step: 0.2
     }
     }
     },
     translation: {
     id: 'translation',
     name: 'Translation',
     values: {
     x: {
     default: 0
     },
     y: {
     default: 0
     }
     }
     },*/
    voi: {
        id: 'voi',
        name: 'Windowing',
        values: {
            windowWidth: {
                name: 'Window Width',
                default: 256
            },
            windowCenter: {
                name: 'Window Center',
                default: 128
            }
        }

    },
    invert: {
        id: 'invert',
        name: 'Invert',
        values: {
            invert: {
                default: false
            }
        }
    },
    /*pixelReplication: {
     id: 'pixelReplication',
     name: 'Interpolation',
     values: {
     pixelReplication: {
     default: true
     }
     }
     },*/
    hflip: {
        id: 'hflip',
        name: 'Horizontal flip',
        values: {
            hflip: {
                default: false
            }
        }
    },
    vflip: {
        id: 'vflip',
        name: 'Vertical flip',
        values: {
            vflip: {
                default: false
            }
        }
    },
    /*rotation: {
     id: 'rotation',
     name: 'Rotation (degrees)',
     values: {
     rotation: {
     default: 0,
     min: -360,
     max: 360,
     step: 90
     }
     }
     }*/
};

HP.toolSettingsTypes = [];

HP.studyAttributes = [{
    id: 'patientId',
    text: '(x00100020) Patient ID'
}, {
    id: 'studyInstanceUid',
    text: '(x0020000d) Study Instance UID'
}, {
    id: 'studyInstanceUid',
    text: '(x0020000d) Study Instance UID'
}, {
    id: 'studyDate',
    text: '(x00080020) Study Date'
}, {
    id: 'studyTime',
    text: '(x00080030) Study Time'
}, {
    id: 'studyDescription',
    text: '(x00081030) Study Description'
}, {
    id: 'abstractPriorValue',
    text: 'Abstract Prior Value'
}];

HP.protocolAttributes = [{
    id: 'patientId',
    text: '(x00100020) Patient ID'
}, {
    id: 'studyInstanceUid',
    text: '(x0020000d) Study Instance UID'
}, {
    id: 'studyDate',
    text: '(x00080020) Study Date'
}, {
    id: 'studyTime',
    text: '(x00080030) Study Time'
}, {
    id: 'studyDescription',
    text: '(x00081030) Study Description'
}, {
    id: 'anatomicRegion',
    text: 'Anatomic Region'
}];

HP.seriesAttributes = [{
    id: 'seriesInstanceUid',
    text: '(x0020000e) Series Instance UID'
}, {
    id: 'modality',
    text: '(x00080060) Modality'
}, {
    id: 'seriesNumber',
    text: '(x00080060) Series Number'
}, {
    id: 'seriesDescription',
    text: '(x0008103e) Series Description'
}, {
    id: 'numImages',
    text: 'Number of Images'
}];

HP.instanceAttributes = [{
    id: 'sopClassUid',
    text: 'SOP Class UID'
}, {
    id: 'sopInstanceUid',
    text: 'SOP Instance UID'
}, {
    id: 'viewPosition',
    text: 'View Position'
}, {
    id: 'instanceNumber',
    text: 'Instance Number'
}, {
    id: 'imageType',
    text: 'Image Type'
}, {
    id: 'frameTime',
    text: 'Frame Time'
}, {
    id: 'laterality',
    text: 'Laterality'
}, {
    id: 'index',
    text: 'Image Index'
}, {
    id: 'photometricInterpretation',
    text: 'Photometric Interpretation'
}, {
    id: 'sliceThickness',
    text: 'Slice Thickness'
}];
