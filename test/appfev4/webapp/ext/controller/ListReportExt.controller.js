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
            const booksModel = this.getView().getModel("books");

            if (!booksModel) {
                console.error("Books model not found");
                return;
            }

            // Load the dialog fragment if not already loaded
            if (!booksDialog) {
                booksDialog = await Fragment.load({
                    id: this.getView().getId(),
                    name: "appfev4.ext.fragment.BooksDialog",
                    controller: this
                });

                this.getView().addDependent(booksDialog);
            }

            // Set the model on the dialog
            booksDialog.setModel(booksModel, "books");

            // Open the dialog
            booksDialog.open();
        },

        /**
         * Handler for closing the dialog
         */
        onCloseDialog: function() {
            if (booksDialog) {
                booksDialog.close();
            }
        }
    };
});
