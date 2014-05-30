// Copyright 2014 Todd Fleming
//
// This file is part of jscut.
//
// jscut is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// jscut is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with jscut.  If not, see <http://www.gnu.org/licenses/>.

function GcodeConversionViewModel(materialViewModel, toolModel, operationsViewModel) {
    var self = this;
    self.units = ko.observable("mm");
    self.unitConverter = new UnitConverter(self.units);
    self.gcodeUrl = ko.observable(null);

    self.generateGcode = function () {
        ops = [];
        if (operationsViewModel.operations().length == 0) {
            showAlert("There are no operations. Use the \"Create Operation\" button.", "alert-danger");
            return;
        }
        for (var i = 0; i < operationsViewModel.operations().length; ++i) {
            op = operationsViewModel.operations()[i];
            if (op.enabled()) {
                if (op.toolPaths == null || op.toolPaths.length == 0) {
                    showAlert("An operation is missing toolpaths; click \"Generate\" by all visible operations.", "alert-danger");
                    return;
                }
                ops.push(op);
            }
        }
        if (ops.length == 0) {
            showAlert("No operations are visible. Select the checkboxes by the operations you wish to convert.", "alert-danger");
            return;
        }

        var safeZ = self.unitConverter.fromPx(materialViewModel.matZSafeMove.toPx());
        var rapidRate = self.unitConverter.fromPx(toolModel.rapidRate.toPx());
        var plungeRate = self.unitConverter.fromPx(toolModel.plungeRate.toPx());
        var cutRate = self.unitConverter.fromPx(toolModel.cutRate.toPx());
        var passDepth = self.unitConverter.fromPx(toolModel.passDepth.toPx());

        if(passDepth <= 0) {
            showAlert("Pass Depth is not greater than 0.", "alert-danger");
            return;
        }

        var scale;
        if(self.units == "inch")
            scale = 1 / Path.svgPxPerInch / Path.snapToClipperScale;
        else
            scale = 25.4 / Path.svgPxPerInch / Path.snapToClipperScale;
        var topZ = self.unitConverter.fromPx(materialViewModel.matTopZ.toPx());

        var gcode = "";
        if (self.units() == "inch")
            gcode += "G20         ; Set units to inches\r\n";
        else
            gcode += "G21         ; Set units to mm\r\n";
        gcode += "G90         ; Absolute positioning\r\n";
        gcode += "G1 Z" + safeZ + " F" + rapidRate + "      ; Move to clearance level\r\n"

        for (var opIndex = 0; opIndex < ops.length; ++opIndex) {
            var op = ops[opIndex];
            var cutDepth = self.unitConverter.fromPx(op.cutDepth.toPx());
            if(cutDepth <= 0) {
                showAlert("An operation has a cut depth which is not greater than 0.", "alert-danger");
                return;
            }

            gcode +=
                "\r\n;" +
                "\r\n; Operation:    " + opIndex +
                "\r\n; Type:         " + op.camOp() +
                "\r\n; Paths:        " + op.toolPaths.length +
                "\r\n; Cut Depth:    " + cutDepth +
                "\r\n; Pass Depth:   " + passDepth +
                "\r\n; Plunge rate:  " + plungeRate +
                "\r\n; Cut rate:     " + cutRate +
                "\r\n;\r\n";

            gcode += Cam.getGcode({
                paths:          op.toolPaths,
                scale:          scale,
                decimal:        4,
                topZ:           topZ,
                botZ:           topZ - cutDepth,
                safeZ:          safeZ,
                passDepth:      passDepth,
                plungeFeed:     plungeRate,
                retractFeed:    rapidRate,
                cutFeed:        cutRate,
                rapidFeed:      rapidRate
            });
        }

        if (self.gcodeUrl() != null)
            URL.revokeObjectURL(self.gcodeUrl());
        self.gcodeUrl(URL.createObjectURL(new Blob([gcode])));

        tutorial(6, 'You\'re done! Right-click "Get Gcode" and select "Save link as..." to save your gcode.');
    }
}