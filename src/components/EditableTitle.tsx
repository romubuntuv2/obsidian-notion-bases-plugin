import { DatabaseManager } from "../database-manager"
import { useClickOrDoubleClick } from "../hooks/useClickOrDoubleClick"
import { Notice, TFile } from "obsidian"
import { useEffect, useRef, useState } from "react"


interface EditableTitleProps {
    title: string
    file: TFile
    manager: DatabaseManager
    onOpen:(file: TFile) => void
    className?: string
    disabled?: boolean
} 



export default function EditableTitle({
    title,
    file,
    manager,
    onOpen,
    className,
    disabled = false,
}: EditableTitleProps) {

    const clickHandlers = useClickOrDoubleClick({
        onClick: () => onOpen(file),
        onDoubleClick: () => {
            if (disabled) {
                return;
            }
            setEditing(true);
        },
    });

    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(title);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setValue(title);
    }, [title]);

    useEffect(() => {
        if (!editing) return;

        window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });
    }, [editing]);

    async function save() {

        setEditing(false);
        const newTitle = value.trim();

        if ( newTitle.length === 0 ||newTitle === title)  {
            setValue(title);
            return;
        }

        try {
            await manager.renameNote(file, newTitle);
        } catch (err) {
            console.error(err);
            new Notice("Unable to rename note");
            setValue(title);
        }
    }

    function cancel() {
        setValue(title);
        setEditing(false);
    }

    if (editing) {
        return (
            <input
                ref={inputRef}
                className={className}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => { void save() }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    switch (e.key) {
                        case "Enter":
                            void save();
                            break;
                        case "Escape":
                            cancel();
                            break;
                    }
                }}
            />
        );
        }

    return (
        <div
            className={className}
            {...clickHandlers}
        >
            {title}
        </div>
    );
}
