---
name: prx-dev-principles
description: >-
  Reference checklist of core software engineering principles — DRY, KISS,
  YAGNI, POLA, Law of Demeter, SOLID, separation of concerns, modularity,
  composition over inheritance, convention over configuration, task/scope
  discipline, and implementation/operational principles (least privilege,
  configuration safety, readability). Use when designing, reviewing, or
  refactoring code and you want to sanity-check the approach against
  established principles, or when the user asks to "apply best practices",
  "check this against SOLID/DRY", or wants a principled second opinion on
  a design or implementation decision. Also useful when decomposing work
  into sub-tasks and wanting to keep scope disciplined and modular.
---

# Software Development Principles Guidance

This document outlines key principles to guide design, implementation, testing, and task management within the project. Consult and apply these principles as relevant to the activity at hand.

## Core Principles

*   **DRY (Don't Repeat Yourself):** Avoid duplication of code or logic. Ensure that each piece of knowledge or functionality exists in only one place. Strive to abstract and reuse common patterns.
*   **KISS (Keep It Simple, Stupid):** Strive for simplicity in code design and implementation. Avoid unnecessary complexity. Choose the most straightforward approach that meets the requirements.
*   **YAGNI (You Ain't Gonna Need It):** Do not add features or functionality until they are actually needed and explicitly requested or defined in the current scope. Avoid speculative features or over-engineering.
*   **Principle of Least Astonishment (POLA):** Software components, APIs, and user interfaces should behave in a way that is intuitive and predictable, minimizing surprises for developers integrating with the code or users interacting with the software.
*   **Law of Demeter (LoD) / Principle of Least Knowledge:** Minimize dependencies between objects/modules. An object should only talk to its immediate "friends" (its own methods, parameters, objects it creates, direct component objects) and not reach through intermediate objects to access others.

## SOLID Principles (Object-Oriented & Component Design)

*   **Single Responsibility Principle (SRP):** A class, module, or function should have only one reason to change, meaning it should have only one primary responsibility or job.
*   **Open/Closed Principle (OCP):** Software entities (classes, modules, functions) should be open for extension (adding new functionality) but closed for modification (changing existing, working code). Favor abstractions, interfaces, and composition.
*   **Liskov Substitution Principle (LSP):** Subtypes must be substitutable for their base types without altering the correctness of the program. If you have a function that works with a base type, it should also work correctly with any derived type.
*   **Interface Segregation Principle (ISP):** Clients (code using an interface/module) should not be forced to depend on methods or properties they do not use. Prefer smaller, more specific interfaces over large, monolithic ones.
*   **Dependency Inversion Principle (DIP):** High-level modules (e.g., business logic) should not depend directly on low-level modules (e.g., data access, specific external services). Both should depend on abstractions (e.g., interfaces, abstract classes). Abstractions should not depend on details; details should depend on abstractions.

## Design and Architecture Principles

*   **Separation of Concerns:** Divide the system into distinct sections, each addressing a separate concern (e.g., UI, business logic, data access, configuration). This improves modularity and maintainability.
*   **Modularity:** Design and implement software as a collection of independent, interchangeable modules with well-defined interfaces. This aids reuse, testing, and parallel development.
*   **Composition over Inheritance:** Favor composing objects from smaller, focused components over inheriting behavior from complex base classes. Composition often leads to more flexible and maintainable designs.
*   **Convention over Configuration (CoC):** Reduce the number of decisions developers need to make and the amount of explicit configuration required by establishing sensible defaults and following established conventions for the chosen framework or language ecosystem.

## Task Definition & Workflow Principles

*   **Simplicity (Task Focus):** Sub-activity definitions should aim for the simplest possible implementation that meets the specified requirements. Avoid gold-plating within individual tasks.
*   **Scope Discipline:** Sub-activity descriptions must be specific and well-defined to prevent scope creep. Any significant change in requirements necessitates re-evaluation and potentially defining new sub-activities.
*   **Pattern Consistency:** New sub-activities involving code or architecture should align with established project patterns documented in planning docs or existing code, unless the task explicitly involves defining or refactoring a pattern.
*   **Modularity & Low Coupling (Task Focus):** Define sub-activities such that their outputs (code, documentation) are modular, have clear interfaces, and minimize tight coupling with other components not directly related to the task.
*   **Impact Analysis:** When decomposing tasks, consider dependencies between sub-activities and sequence them logically.

## Implementation & Operational Principles

*   **Environment Awareness:** Tasks involving implementation or deployment must consider and specify target environments (development, testing, production) if relevant, especially regarding configuration or dependencies.
*   **Configuration Safety:** Tasks involving configuration changes must specify safe handling procedures, avoiding hardcoded secrets and utilizing environment variables or secure configuration management practices where appropriate.
*   **Principle of Least Privilege (PoLP):** Code modules or components should only be granted the permissions and access to resources absolutely necessary to perform their designated function.
*   **Code Readability:** Write code that is clear, well-formatted (adhering to project standards like Prettier/ESLint), appropriately commented (especially for complex logic), and uses meaningful names for variables, functions, and classes.

## Process & Collaboration Principles

*   **Embrace Change (Adaptability):** While scope discipline is important for individual tasks, the overall process should accommodate evolving requirements. Be prepared to adapt designs and plans based on feedback or new information.
