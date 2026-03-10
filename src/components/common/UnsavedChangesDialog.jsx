import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UnsavedChangesDialog({
  open,
  onCancel,
  onSaveAndContinue,
}) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ungespeicherte Änderungen</AlertDialogTitle>
          <AlertDialogDescription>
            Du hast ungespeicherte Änderungen. Möchtest du diese speichern, bevor du fortfährst?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3 justify-end">
          <AlertDialogCancel onClick={onCancel}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onSaveAndContinue}>
            Speichern & Weiter
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}