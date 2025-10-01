sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/m/Dialog"
], function(Fragment, Dialog) {
    "use strict";

    let booksDialog = null;

    return {
        /**
         * Handler for the custom "Show Available Books" button
         */
        onShowBooks: async function() {
            // Get the books model
            const booksModel = this.getEditFlow().getView().getModel("books");

            if (!booksModel) {
                console.error("Books model not found");
                return;
            }

            // Load the dialog fragment if not already loaded
            if (!booksDialog) {
                booksDialog = await Fragment.load({
                    id: this.getEditFlow().getView().getId(),
                    name: "appfev4.ext.fragment.BooksDialog"
                });

                this.getEditFlow().getView().addDependent(booksDialog);

                // Manually attach the close event to the button
                const closeButton = booksDialog.getBeginButton();
                if (closeButton) {
                    closeButton.attachPress(function() {
                        console.log("Close button clicked programmatically");
                        booksDialog.close();
                    });
                }
            }

            // Set the model on the dialog
            booksDialog.setModel(booksModel, "books");

            // Open the dialog
            booksDialog.open();
        }
    };
});
