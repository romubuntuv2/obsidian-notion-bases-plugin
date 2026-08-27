import { App, Menu, TFile } from 'obsidian'
import { DatabaseManager } from '../../database-manager'
import { t } from '../../i18n'

interface ShowNoteContextMenuOptions {
	event: MouseEvent
	app: App
	manager: DatabaseManager
	file: TFile
}

export function showNoteContextMenu({ event, app, manager, file }: ShowNoteContextMenuOptions): void {
	const menu = new Menu()
	menu.addItem(item => item
		.setTitle(t('open_note'))
		.setIcon('file')
		.onClick(() => { void app.workspace.getLeaf().openFile(file) }))
	menu.addItem(item => item
		.setTitle(t('duplicate_note'))
		.setIcon('copy')
		.onClick(() => { void manager.duplicateNotes([file]) }))
	menu.addSeparator()
	menu.addItem(item => item
		.setTitle(t('delete_note'))
		.setIcon('trash')
		.onClick(() => { void manager.deleteNotes([file]) }))
	menu.showAtMouseEvent(event)
}
